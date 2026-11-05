package expo.modules.seshatbubble.widgets

import android.content.Context
import android.widget.RemoteViews
import expo.modules.seshatbubble.R
import org.json.JSONObject

/** "Month at a glance": spent so far against the budget (or income), today, and the last entry. */
class SeshatMonthWidget : SummaryWidget() {
  override val layout = R.layout.seshat_widget_month
  override fun rootId() = R.id.sw_root

  override fun bind(ctx: Context, v: RemoteViews, s: JSONObject?, ar: Boolean, signedIn: Boolean) {
    v.setTextViewText(R.id.sw_title, if (ar) "هذا الشهر" else "THIS MONTH")
    if (s == null) {
      v.setTextViewText(R.id.sw_big, if (ar) "سيشات" else "Seshat")
      v.setTextViewText(R.id.sw_sub, if (signedIn) (if (ar) "جارٍ التحميل…" else "Loading…")
        else (if (ar) "افتح التطبيق وسجّل الدخول مرة" else "Open the app and sign in once"))
      v.setTextViewText(R.id.sw_pct, ""); v.setTextViewText(R.id.sw_stats, ""); v.setTextViewText(R.id.sw_last, "")
      for (b in listOf(R.id.sw_bar_good, R.id.sw_bar_warn, R.id.sw_bar_bad)) v.setViewVisibility(b, android.view.View.GONE)
      return
    }
    val cur = Look.currency(s.optString("currency", "EGP"), ar)
    val spent = s.optDouble("monthSpent", 0.0)
    val income = s.optDouble("monthIncome", 0.0)
    val percent: Int? = if (!s.isNull("budgetPercent")) s.optInt("budgetPercent")
      else if (income > 0) Math.round(spent / income * 100).toInt() else null

    v.setTextViewText(R.id.sw_big, Look.full(spent))
    v.setTextViewText(R.id.sw_sub, "$cur · " + (if (ar) "مصروف" else "spent"))
    v.setTextViewText(R.id.sw_pct, if (percent != null) "$percent%" else "")
    v.setTextColor(R.id.sw_pct, if (percent != null) Look.tone(percent) else Look.dim)
    val bars = listOf(R.id.sw_bar_good, R.id.sw_bar_warn, R.id.sw_bar_bad)
    val which = when { percent == null -> -1; percent >= 100 -> 2; percent >= 80 -> 1; else -> 0 }
    bars.forEachIndexed { i, id ->
      v.setViewVisibility(id, if (i == which) android.view.View.VISIBLE else android.view.View.GONE)
      if (i == which) v.setProgressBar(id, 100, (percent ?: 0).coerceIn(0, 100), false)
    }
    val parts = mutableListOf((if (ar) "اليوم " else "Today ") + Look.full(s.optDouble("todaySpent", 0.0)))
    if (income > 0) parts.add((if (ar) "الدخل " else "Income ") + Look.full(income))
    v.setTextViewText(R.id.sw_stats, parts.joinToString("  ·  "))
    val last = s.optJSONObject("last")
    v.setTextViewText(R.id.sw_last, if (last == null) "" else {
      val who = last.optString("counterparty").ifEmpty { if (ar) last.optString("categoryAr") else last.optString("categoryEn") }
      val sign = if (last.optString("type") == "income") "+" else "−"
      "$who · $sign${Look.full(last.optDouble("amount", 0.0))}"
    })
  }
}
