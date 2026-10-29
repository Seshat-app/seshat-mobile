// Expo config plugin: adopt the UIScene lifecycle (needed for iOS 27 / Xcode 27).
//
// Apps linked against the iOS 27 SDK that don't adopt UIScene are killed at launch
// (EXC_BREAKPOINT in UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption,
// before any JS runs). Expo SDK 54's template still creates the window in
// AppDelegate; Expo only ships scene support from SDK 57 (ios.enableSceneSupport),
// so on SDK 54 we do it ourselves:
//   1. Info.plist gets a UIApplicationSceneManifest pointing at SceneDelegate.
//   2. AppDelegate stops creating the window / starting React Native.
//   3. SceneDelegate (appended to AppDelegate.swift, so no Xcode-project edit is
//      needed) creates the window for the scene and starts React Native, and
//      forwards deep links / universal links, which no longer reach AppDelegate.
//
// Remove this plugin when upgrading to an Expo SDK with built-in scene support.
const { withInfoPlist, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '// [withSceneLifecycle]';

const SCENE_DELEGATE = `
${MARKER} SceneDelegate: creates the window for the scene and starts React Native.
public class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  public var window: UIWindow?

  public func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    // Scene connection options replace the old launchOptions: map the URL and the
    // user activity back so Linking.getInitialURL() keeps working on a cold start.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window // some Expo modules read AppDelegate.window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }

  // Deep links while the app is already running.
  public func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  // Universal links while the app is already running.
  public func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

/** The Window + startReactNative block Expo generates in didFinishLaunching. */
const WINDOW_BLOCK = /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\(\s*\n\s*withModuleName: "main",\s*\n\s*in: window,\s*\n\s*launchOptions: launchOptions\)\s*\n#endif\s*\n/;

function patchAppDelegate(source) {
  if (source.includes(MARKER)) return source; // already patched
  if (!WINDOW_BLOCK.test(source)) {
    throw new Error(
      'withSceneLifecycle: could not find the window/startReactNative block in AppDelegate.swift. ' +
        'The Expo template changed; update the plugin (or use ios.enableSceneSupport on SDK 57+).',
    );
  }
  const withoutWindow = source.replace(
    WINDOW_BLOCK,
    '    // The window and React Native are started by SceneDelegate (see bottom of file).\n',
  );
  return withoutWindow.replace(/\s*$/, '\n') + SCENE_DELEGATE;
}

/** UIApplicationSceneManifest entry for Info.plist. */
const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
      },
    ],
  },
};

function patchInfoPlistObject(plist) {
  plist.UIApplicationSceneManifest = SCENE_MANIFEST;
  return plist;
}

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults = patchInfoPlist(cfg.modResults);
    return cfg;
  });
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const appDelegate = path.join(root, cfg.modRequest.projectName || 'Seshat', 'AppDelegate.swift');
      if (fs.existsSync(appDelegate)) {
        const before = fs.readFileSync(appDelegate, 'utf8');
        const after = patchAppDelegate(before);
        if (after !== before) fs.writeFileSync(appDelegate, after);
      }
      return cfg;
    },
  ]);
};

function patchInfoPlist(plist) {
  return patchInfoPlistObject(plist);
}

module.exports.patchAppDelegate = patchAppDelegate;
module.exports.patchInfoPlist = patchInfoPlist;
module.exports.SCENE_MANIFEST = SCENE_MANIFEST;

// CLI: `node plugins/withSceneLifecycle.js ios/` patches an existing generated ios/
// folder in place (used by scripts/testflight-local.sh when ios/ isn't regenerated).
if (require.main === module) {
  const plist = require('@expo/plist').default;
  const dir = path.resolve(process.argv[2] || 'ios');
  const appDelegate = path.join(dir, 'Seshat', 'AppDelegate.swift');
  const infoPath = path.join(dir, 'Seshat', 'Info.plist');
  const a = fs.readFileSync(appDelegate, 'utf8');
  const a2 = patchAppDelegate(a);
  if (a2 !== a) { fs.writeFileSync(appDelegate, a2); console.log('patched AppDelegate.swift'); } else console.log('AppDelegate.swift already patched');
  const info = plist.parse(fs.readFileSync(infoPath, 'utf8'));
  if (!info.UIApplicationSceneManifest) {
    fs.writeFileSync(infoPath, plist.build(patchInfoPlist(info)));
    console.log('patched Info.plist');
  } else console.log('Info.plist already has a scene manifest');
}
