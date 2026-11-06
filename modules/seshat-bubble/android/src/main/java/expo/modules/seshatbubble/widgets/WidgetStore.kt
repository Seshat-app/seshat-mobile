package expo.modules.seshatbubble.widgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * What the home-screen widgets know: the phone's capture token + API address + language (handed over by the app
 * through SeshatBubbleModule.setWidgetConfig) and the last /widget/summary they fetched. Plain app-private
 * SharedPreferences: the token is the same read-mostly device token the iPhone widgets use.
 */
object WidgetStore {
  private const val PREFS = "seshat_widgets"
  const val ACTION_REFRESH = "expo.modules.seshatbubble.WIDGETS_REFRESH"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun setConfig(ctx: Context, token: String, api: String, lang: String) {
    prefs(ctx).edit().putString("token", token).putString("api", api).putString("lang", lang).apply()
  }

  fun isArabic(ctx: Context) = prefs(ctx).getString("lang", "en") == "ar"
  fun signedIn(ctx: Context) = !prefs(ctx).getString("token", null).isNullOrEmpty()

  /** The last summary we managed to fetch (may be hours old; the widgets show it rather than nothing). */
  fun cached(ctx: Context): JSONObject? =
    prefs(ctx).getString("summary", null)?.let { runCatching { JSONObject(it) }.getOrNull() }

  /** Fetch a fresh summary (call off the main thread). Returns the cached one when the network fails. */
  fun fetch(ctx: Context): JSONObject? {
    val p = prefs(ctx)
    val token = p.getString("token", null) ?: return null
    val api = p.getString("api", null) ?: return cached(ctx)
    return try {
      val conn = (URL("$api/widget/summary").openConnection() as HttpURLConnection).apply {
        connectTimeout = 3_000; readTimeout = 3_000
        setRequestProperty("Authorization", "Bearer $token")
        setRequestProperty("Accept", "application/json")
      }
      if (conn.responseCode !in 200..299) return cached(ctx)
      val body = conn.inputStream.bufferedReader().use { it.readText() }
      val data = JSONObject(body).optJSONObject("data") ?: return cached(ctx)
      p.edit().putString("summary", data.toString()).apply()
      data
    } catch (_: Exception) {
      cached(ctx)
    }
  }

  /** Redraw every Seshat widget on the home screen from the cache. */
  fun redrawAll(ctx: Context) {
    val mgr = AppWidgetManager.getInstance(ctx)
    for (cls in listOf(
      SeshatMonthWidget::class.java, SeshatBudgetsWidget::class.java, SeshatMaatWidget::class.java,
    )) {
      val ids = mgr.getAppWidgetIds(ComponentName(ctx, cls))
      if (ids.isNotEmpty()) {
        ctx.sendBroadcast(Intent(ctx, cls).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
          .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids))
      }
    }
  }
}
