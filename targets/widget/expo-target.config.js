/** Home-screen and lock-screen widgets (WidgetKit). */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'widget',
  name: 'SeshatWidgets',
  displayName: 'Seshat',
  bundleIdentifier: '.widget',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    $accent: '#C9A84C',
    $widgetBackground: '#0D0D0D',
  },
  entitlements: {
    // Read the device token the app already keeps in the keychain (same team prefix + the
    // app's own bundle id). No App Group capability needed: the provisioning profile's
    // wildcard keychain group covers it.
    'keychain-access-groups': ['$(AppIdentifierPrefix)com.seshat.mobile'],
  },
});
