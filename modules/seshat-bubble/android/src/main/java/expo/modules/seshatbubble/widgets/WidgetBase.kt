package expo.modules.seshatbubble.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.DecimalFormat

internal object Look {
  val text = Color.parseColor("#EDE6D6")
  val dim = Color.parseColor("#8D877B")
  val gold = Color.parseColor("#D4AF37")
  val good = Color.parseColor("#4ABA7A")
  val warn = Color.parseColor("#D4AF37")
  val bad = Color.parseColor("#E05555")

  /** Traffic-light colour for a "percent used" figure. */
  fun tone(percent: Int) = when { percent >= 100 -> bad; percent >= 80 -> warn; else -> good }

  private val whole = DecimalFormat("#,##0")
  fun full(n: Double): String = whole.format(Math.round(n))
  fun compact(n: Double): String = when {
    n >= 1_000_000 -> DecimalFormat("0.#").format(n / 1_000_000) + "M"
    n >= 10_000 -> DecimalFormat("0.#").format(n / 1_000) + "K"
    else -> full(n)
  }
  fun currency(code: String, ar: Boolean) = if (ar && code == "EGP") "ج.م" else code
}

internal fun opens(ctx: Context, link: String, code: Int): PendingIntent {
  val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link)).apply {
    setPackage(ctx.packageName)
    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  }
  return PendingIntent.getActivity(ctx, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
}

/**
 * A data widget: draws instantly from the cached summary, then fetches a fresh one in the background and
 * draws again. Android only calls onUpdate about every 30 minutes on its own; the app also nudges the
 * widgets whenever it is opened or its data changes.
 */
abstract class SummaryWidget : AppWidgetProvider() {
  abstract val layout: Int
  /** The id of the layout's outermost view (taps on it open the app). */
  abstract fun rootId(): Int
  /** Fill the views. `s` is null when signed out or nothing was fetched yet. */
  internal abstract fun bind(ctx: Context, v: RemoteViews, s: JSONObject?, ar: Boolean, signedIn: Boolean)

  private fun draw(ctx: Context, mgr: AppWidgetManager, ids: IntArray, s: JSONObject?) {
    val ar = WidgetStore.isArabic(ctx)
    for (id in ids) {
      val v = RemoteViews(ctx.packageName, layout)
      v.setOnClickPendingIntent(rootId(), opens(ctx, "seshat://", 10))
      bind(ctx, v, s, ar, WidgetStore.signedIn(ctx))
      mgr.updateAppWidget(id, v)
    }
  }

  override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
    draw(ctx, mgr, ids, WidgetStore.cached(ctx))
    // A widget update arrives as a broadcast, which Android gives about 10 seconds. Fetch on a worker and stop
    // waiting after 6 seconds so the broadcast always finishes in time (the cached figures are already drawn).
    val pending = goAsync()
    val pool = java.util.concurrent.Executors.newSingleThreadExecutor()
    Thread {
      try {
        val fresh = try {
          pool.submit<JSONObject?> { WidgetStore.fetch(ctx) }.get(6, java.util.concurrent.TimeUnit.SECONDS)
        } catch (_: Exception) { null }
        if (fresh != null) draw(ctx, mgr, ids, fresh)
      } finally {
        pool.shutdownNow()
        pending.finish()
      }
    }.start()
  }
}
