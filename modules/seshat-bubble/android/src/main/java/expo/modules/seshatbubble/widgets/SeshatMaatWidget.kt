package expo.modules.seshatbubble.widgets

import android.content.Context
import android.view.View
import android.widget.RemoteViews
import expo.modules.seshatbubble.R
import org.json.JSONObject

/** Maat's verdict: whether the month is in balance, weighed from the pace so far. */
class SeshatMaatWidget : SummaryWidget() {
  override val layout = R.layout.seshat_widget_maat
  override fun rootId() = R.id.sw_root

  override fun bind(ctx: Context, v: RemoteViews, s: JSONObject?, ar: Boolean, signedIn: Boolean) {
    v.setTextViewText(R.id.sw_title, if (ar) "حكم ماعت" else "MAAT'S VERDICT")
    val verdict = s?.optJSONObject("verdict")
    if (s == null || verdict == null) {
      v.setTextViewText(R.id.sw_state, if (ar) "ما زالت تزن" else "Still weighing")
      v.setTextColor(R.id.sw_state, Look.dim)
      v.setTextViewText(R.id.sw_line, when {
        s == null && !signedIn -> if (ar) "افتح التطبيق وسجّل الدخول مرة." else "Open the app and sign in once."
        s == null -> if (ar) "جارٍ التحميل…" else "Loading…"
        else -> if (ar) "بضعة أيام أخرى من السجلات وتستطيع الحكم." else "A few more days of records and she can judge."
      })
      v.setTextViewText(R.id.sw_days, ""); v.setTextViewText(R.id.sw_watch, "")
      return
    }
    val (title, color) = when (verdict.optString("state")) {
      "balanced" -> (if (ar) "في توازن" else "In balance") to Look.good
      "leaning" -> (if (ar) "تميل للثقل" else "Leaning heavy") to Look.warn
      "over" -> (if (ar) "فوق الحد" else "Over the line") to Look.bad
      else -> (if (ar) "ما زالت تزن" else "Still weighing") to Look.dim
    }
    v.setTextViewText(R.id.sw_state, title)
    v.setTextColor(R.id.sw_state, color)
    val cur = Look.currency(s.optString("currency", "EGP"), ar)
    val tail = if (verdict.optString("basis") == "income") (if (ar) " دخل" else " income") else ""
    v.setTextViewText(R.id.sw_line, if (verdict.optString("state") == "none")
      (if (ar) "بضعة أيام أخرى من السجلات وتستطيع الحكم." else "A few more days of records and she can judge.")
    else if (ar) "في طريقها إلى ${Look.full(verdict.optDouble("projected"))} من ${Look.full(verdict.optDouble("limit"))} $cur$tail"
    else "Heading for ${Look.full(verdict.optDouble("projected"))} of ${Look.full(verdict.optDouble("limit"))} $cur$tail")
    v.setTextViewText(R.id.sw_days, (if (ar) "أيام متبقية " else "Days left ") + verdict.optInt("daysLeft"))
    val w = verdict.optJSONObject("watch")
    v.setViewVisibility(R.id.sw_watch, if (w == null) View.GONE else View.VISIBLE)
    if (w != null) {
      val name = if (ar && w.optString("nameAr").isNotEmpty()) w.optString("nameAr") else w.optString("nameEn")
      v.setTextViewText(R.id.sw_watch, (if (ar) "راقب · " else "Watch · ") + "$name ${w.optInt("percent")}%")
    }
  }
}
