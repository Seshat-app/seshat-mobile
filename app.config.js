// Dynamic Expo config layered on top of app.json.
//
// The push-notification entitlement has to match the provisioning profile the
// build is signed with. TestFlight / App Store / ad-hoc builds use Apple's
// PRODUCTION push environment; local and development-client builds use
// DEVELOPMENT. A hard-coded "development" value makes store uploads fail
// ("Invalid Code Signing Entitlements"), so pick it from the EAS profile.
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const apsEnvironment = profile === 'production' || profile === 'preview' ? 'production' : 'development';

  // iPhone widgets (targets/widget) ship as a second app extension that needs its own App ID and
  // provisioning profile. Until that exists, normal builds must not include it, so it is opt-in:
  //   SESHAT_WIDGETS=1 npx expo prebuild --platform ios
  const withWidgets = process.env.SESHAT_WIDGETS === '1';

  return {
    ...config,
    plugins: [...(config.plugins ?? []), ...(withWidgets ? ['@bacons/apple-targets'] : [])],
    ios: {
      ...config.ios,
      ...(withWidgets ? { appleTeamId: 'LTYTC93ARN' } : {}),
      entitlements: {
        ...(config.ios?.entitlements ?? {}),
        'aps-environment': apsEnvironment,
      },
    },
  };
};
