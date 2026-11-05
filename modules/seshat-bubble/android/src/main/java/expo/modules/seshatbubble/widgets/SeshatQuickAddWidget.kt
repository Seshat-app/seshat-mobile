package expo.modules.seshatbubble.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import expo.modules.seshatbubble.R

/** Quick add: three tiles that open Seshat on the add sheet, the receipt scanner, or a fresh chat. */
class SeshatQuickAddWidget : AppWidgetProvider() {
  override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
    val ar = WidgetStore.isArabic(ctx)
    for (id in ids) {
      val v = RemoteViews(ctx.packageName, R.layout.seshat_widget_quickadd)
      v.setTextViewText(R.id.sw_qa_add_t, if (ar) "أضف" else "Add")
      v.setTextViewText(R.id.sw_qa_receipt_t, if (ar) "إيصال" else "Receipt")
      v.setTextViewText(R.id.sw_qa_chat_t, if (ar) "اسأل سيشات" else "Ask Seshat")
      v.setOnClickPendingIntent(R.id.sw_qa_add, opens(ctx, "seshat://add?mode=manual", 1))
      v.setOnClickPendingIntent(R.id.sw_qa_receipt, opens(ctx, "seshat://add?mode=receipt", 2))
      v.setOnClickPendingIntent(R.id.sw_qa_chat, opens(ctx, "seshat://add?mode=chat", 3))
      mgr.updateAppWidget(id, v)
    }
  }
}
