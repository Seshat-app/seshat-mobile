// Expo config plugin: an Android home-screen "Quick add" widget.
//
// A small dark-and-gold widget with three tiles (Add, Receipt, Ask Seshat). Each one opens the app on that
// screen through the same seshat://add?mode=... deep links the iPhone widget uses. Plain RemoteViews, no
// Jetpack Glance, so it adds no dependencies. Android has no lock-screen widgets (Android 16 removed them for
// phones), so this is the home screen only.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const PKG = 'com.seshat.app';
const RECEIVER = `${PKG}.SeshatQuickAddWidget`;

const KOTLIN = `package ${PKG}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class SeshatQuickAddWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.seshat_quick_add_widget)
      views.setOnClickPendingIntent(R.id.seshat_widget_add, link(context, "manual", 1))
      views.setOnClickPendingIntent(R.id.seshat_widget_receipt, link(context, "receipt", 2))
      views.setOnClickPendingIntent(R.id.seshat_widget_chat, link(context, "chat", 3))
      manager.updateAppWidget(id, views)
    }
  }

  private fun link(context: Context, mode: String, code: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("seshat://add?mode=$mode")).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
`;

const tile = (id, label, glyph, fill) => `
    <LinearLayout
        android:id="@+id/${id}"
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:layout_margin="4dp"
        android:background="${fill}"
        android:gravity="center"
        android:orientation="vertical">
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="${glyph}"
            android:textColor="${fill === '@drawable/seshat_widget_tile_gold' ? '#0D0D0D' : '#D4AF37'}"
            android:textSize="22sp"
            android:textStyle="bold" />
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="2dp"
            android:text="${label}"
            android:textColor="${fill === '@drawable/seshat_widget_tile_gold' ? '#0D0D0D' : '#EDE6D6'}"
            android:textSize="11sp"
            android:textStyle="bold" />
    </LinearLayout>`;

const LAYOUT = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/seshat_widget_bg"
    android:orientation="horizontal"
    android:padding="6dp">${tile('seshat_widget_add', 'Add', '+', '@drawable/seshat_widget_tile_gold')}${tile('seshat_widget_receipt', 'Receipt', '&#9635;', '@drawable/seshat_widget_tile')}${tile('seshat_widget_chat', 'Ask Seshat', '&#10022;', '@drawable/seshat_widget_tile')}
</LinearLayout>
`;

const shape = (color, radius) => `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${color}" />
    <corners android:radius="${radius}dp" />
</shape>
`;

const INFO = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="70dp"
    android:targetCellWidth="4"
    android:targetCellHeight="1"
    android:updatePeriodMillis="0"
    android:resizeMode="horizontal"
    android:widgetCategory="home_screen"
    android:initialLayout="@layout/seshat_quick_add_widget"
    android:description="@string/seshat_widget_description" />
`;

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

module.exports = function withAndroidWidget(config) {
  config = withDangerousMod(config, ['android', (c) => {
    const main = path.join(c.modRequest.platformProjectRoot, 'app/src/main');
    write(path.join(main, 'java', ...PKG.split('.'), 'SeshatQuickAddWidget.kt'), KOTLIN);
    write(path.join(main, 'res/layout/seshat_quick_add_widget.xml'), LAYOUT);
    write(path.join(main, 'res/xml/seshat_quick_add_widget_info.xml'), INFO);
    write(path.join(main, 'res/drawable/seshat_widget_bg.xml'), shape('#0D0D0D', 18));
    write(path.join(main, 'res/drawable/seshat_widget_tile.xml'), shape('#1A1A1A', 14));
    write(path.join(main, 'res/drawable/seshat_widget_tile_gold.xml'), shape('#D4AF37', 14));
    write(path.join(main, 'res/values/seshat_widget_strings.xml'),
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="seshat_widget_description">Log an expense, scan a receipt, or ask Seshat in one tap.</string>\n</resources>\n');
    return c;
  }]);
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
    app.receiver = app.receiver ?? [];
    if (!app.receiver.some((r) => r.$['android:name'] === RECEIVER)) {
      app.receiver.push({
        $: { 'android:name': RECEIVER, 'android:exported': 'true', 'android:label': 'Seshat Quick add' },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
        'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/seshat_quick_add_widget_info' } }],
      });
    }
    return c;
  });
};
