// Expo config plugin: drop react-native-android-notification-listener's BootUpReceiver.
//
// On BOOT_COMPLETED that receiver calls startForegroundService() on the listener, but the
// listener is a NotificationListenerService and never calls startForeground(). Android 8+
// then kills the app with ForegroundServiceDidNotStartInTimeException after every reboot
// (seen in Sentry), for everyone who has the app installed. The system already binds the
// listener on its own once notification access is granted, so the receiver isn't needed.
const { withAndroidManifest } = require('@expo/config-plugins');

const RECEIVER = 'com.lesimoes.androidnotificationlistener.BootUpReceiver';

module.exports = function withNoBootReceiver(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    app.receiver = app.receiver ?? [];
    if (!app.receiver.some((r) => r.$['android:name'] === RECEIVER)) {
      app.receiver.push({ $: { 'android:name': RECEIVER, 'tools:node': 'remove' } });
    }
    return c;
  });
};
