package expo.modules.seshatbubble.widgets

import android.content.Context
import android.view.View
import android.widget.RemoteViews
import expo.modules.seshatbubble.R
import org.json.JSONObject

/** "Budgets and cards": budgets as progress bars on the left, spending per card on the right. */
class SeshatBudgetsWidget : SummaryWidget() {
  override val layout = R.layout.seshat_widget_budgets
  override fun rootId() = R.id.sw_root

  private val names = intArrayOf(R.id.sw_b1_name, R.id.sw_b2_name, R.id.sw_b3_name)
  private val pcts = intArrayOf(R.id.sw_b1_pct, R.id.sw_b2_pct, R.id.sw_b3_pct)
  private val good = intArrayOf(R.id.sw_b1_g, R.id.sw_b2_g, R.id.sw_b3_g)
  private val warn = intArrayOf(R.id.sw_b1_w, R.id.sw_b2_w, R.id.sw_b3_w)
  private val bad = intArrayOf(R.id.sw_b1_b, R.id.sw_b2_b, R.id.sw_b3_b)
  private val rows = intArrayOf(R.id.sw_b1, R.id.sw_b2, R.id.sw_b3)
  private val cardNames = intArrayOf(R.id.sw_c1_name, R.id.sw_c2_name, R.id.sw_c3_name)
  private val cardAmts = intArrayOf(R.id.sw_c1_amt, R.id.sw_c2_amt, R.id.sw_c3_amt)
  private val cardRows = intArrayOf(R.id.sw_c1, R.id.sw_c2, R.id.sw_c3)

  override fun bind(ctx: Context, v: RemoteViews, s: JSONObject?, ar: Boolean, signedIn: Boolean) {
    v.setTextViewText(R.id.sw_b_title, if (ar) "الميزانيات" else "BUDGETS")
    v.setTextViewText(R.id.sw_c_title, if (ar) "حسب البطاقة" else "BY CARD")
    val budgets = s?.optJSONArray("budgets")
    val cards = s?.optJSONArray("cards")
    val cur = Look.currency(s?.optString("currency", "EGP") ?: "EGP", ar)

    v.setTextViewText(R.id.sw_b_empty, when {
      s == null -> if (signedIn) (if (ar) "جارٍ التحميل…" else "Loading…") else (if (ar) "افتح التطبيق وسجّل الدخول مرة" else "Open the app and sign in once")
      (budgets?.length() ?: 0) == 0 -> if (ar) "لا ميزانيات بعد." else "No budgets yet."
      else -> ""
    })
    for (i in 0 until 3) {
      val b = budgets?.optJSONObject(i)
      v.setViewVisibility(rows[i], if (b == null) View.GONE else View.VISIBLE)
      if (b == null) continue
      val percent = b.optInt("percent", 0)
      val name = if (ar && b.optString("nameAr").isNotEmpty()) b.optString("nameAr") else b.optString("nameEn")
      v.setTextViewText(names[i], name)
      v.setTextViewText(pcts[i], "$percent%")
      v.setTextColor(pcts[i], Look.tone(percent))
      val which = when { percent >= 100 -> 2; percent >= 80 -> 1; else -> 0 }
      listOf(good[i], warn[i], bad[i]).forEachIndexed { k, id ->
        v.setViewVisibility(id, if (k == which) View.VISIBLE else View.GONE)
        if (k == which) v.setProgressBar(id, 100, percent.coerceIn(0, 100), false)
      }
    }
    v.setTextViewText(R.id.sw_c_empty, if (s != null && (cards?.length() ?: 0) == 0) (if (ar) "يظهر إنفاق البطاقات بعد تسجيل رسائل البنك." else "Card spending appears once bank messages are logged.") else "")
    for (i in 0 until 3) {
      val c = cards?.optJSONObject(i)
      v.setViewVisibility(cardRows[i], if (c == null) View.GONE else View.VISIBLE)
      if (c == null) continue
      v.setTextViewText(cardNames[i], c.optString("label"))
      v.setTextViewText(cardAmts[i], Look.compact(c.optDouble("spent", 0.0)) + " " + cur)
    }
  }
}
