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

  return {
    ...config,
    ios: {
      ...config.ios,
      entitlements: {
        ...(config.ios?.entitlements ?? {}),
        'aps-environment': apsEnvironment,
      },
    },
  };
};
