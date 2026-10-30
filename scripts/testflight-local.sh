#!/usr/bin/env bash
# Build an App Store / TestFlight .ipa on THIS Mac with Xcode (no EAS cloud build).
#
#   scripts/testflight-local.sh --check     only verify certificate / profile / project
#   scripts/testflight-local.sh             check, then archive and export the .ipa
#   scripts/testflight-local.sh --upload    ...and upload it (see "Upload" below)
#
# Signing uses the team that issued the certificates:
#   Team ID        LTYTC93ARN
#   App ID         com.seshat.mobile
#   Certificate    Apple Distribution (distribution_momen.cer + its private key)
#   Profile        momen_khalled_dis (App Store, production push)
#
# Widgets (optional): the iPhone widget extension is a second app target (targets/widget) with its
# own App ID and App Store profile. To include it, generate the project with  SESHAT_WIDGETS=1
# (npx expo prebuild --platform ios --clean) and run this script with
#   WIDGET_PROFILE_NAME=<name>  WIDGET_PROFILE_FILE=<path to its .mobileprovision>
# for App ID com.seshat.mobile.widget. Without a widget target in ios/, nothing changes.
#
# Upload: set ASC_API_KEY (key id) and ASC_API_ISSUER (issuer id) for an App Store
# Connect API key whose .p8 is in ~/.appstoreconnect/private_keys/, OR skip --upload
# and drag the .ipa into the Transporter app / Xcode Organizer.
set -euo pipefail

# The Sentry build phase uploads debug symbols and fails without an org/auth token.
export SENTRY_DISABLE_AUTO_UPLOAD=true

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
TEAM="LTYTC93ARN"
BUNDLE="com.seshat.mobile"
PROFILE_NAME="momen_khalled_dis"
PROFILE_FILE="${PROFILE_FILE:-$HOME/Downloads/momen_khalled_dis.mobileprovision}"
CERT_FILE="${CERT_FILE:-$HOME/Downloads/distribution_momen.cer}"
PROFILES_DIR="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
BUILD_DIR="$ROOT/build"
ARCHIVE="$BUILD_DIR/Seshat.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"
MODE="${1:-build}"
WIDGET_BUNDLE="$BUNDLE.widget"
WIDGET_PROFILE_NAME="${WIDGET_PROFILE_NAME:-}"
WIDGET_PROFILE_FILE="${WIDGET_PROFILE_FILE:-}"
HAS_WIDGET=0
grep -q "SeshatWidgets.appex" "$IOS/Seshat.xcodeproj/project.pbxproj" 2>/dev/null && HAS_WIDGET=1

say()  { printf '\033[1;33m==>\033[0m %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; exit 1; }

say "1/5 Distribution certificate"
if security find-identity -v -p codesigning | grep -q "Apple Distribution"; then
  ok "$(security find-identity -v -p codesigning | grep 'Apple Distribution' | head -1 | sed 's/^ *[0-9]*) [A-F0-9]* //')"
else
  echo "  No 'Apple Distribution' signing identity in your keychain."
  echo "  Install it: double-click  $CERT_FILE  (it must land in the 'login' keychain)."
  echo "  It pairs with the private key made when the certificate request was created on this Mac."
  echo "  If it still isn't listed afterwards, the private key is missing: a new certificate"
  echo "  request must be made on this Mac and re-issued by the team owner."
  fail "distribution identity missing"
fi

say "2/5 Provisioning profile"
[ -f "$PROFILE_FILE" ] || fail "profile not found: $PROFILE_FILE"
TMP_PLIST="$(mktemp)"; security cms -D -i "$PROFILE_FILE" > "$TMP_PLIST"
UUID="$(/usr/libexec/PlistBuddy -c 'Print :UUID' "$TMP_PLIST")"
APPID="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:application-identifier' "$TMP_PLIST")"
APS="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:aps-environment' "$TMP_PLIST" 2>/dev/null || echo none)"
rm -f "$TMP_PLIST"
[ "$APPID" = "$TEAM.$BUNDLE" ] || fail "profile is for '$APPID', expected '$TEAM.$BUNDLE'"
ok "$PROFILE_NAME  ($APPID, push: $APS)"
mkdir -p "$PROFILES_DIR"
cp -f "$PROFILE_FILE" "$PROFILES_DIR/$UUID.mobileprovision"
ok "installed for Xcode ($UUID)"

if [ "$HAS_WIDGET" = 1 ]; then
  [ -n "$WIDGET_PROFILE_NAME" ] && [ -f "$WIDGET_PROFILE_FILE" ] \
    || fail "ios/ has the widget target: set WIDGET_PROFILE_NAME and WIDGET_PROFILE_FILE (profile for $WIDGET_BUNDLE), or regenerate ios/ without SESHAT_WIDGETS=1"
  TMP_PLIST="$(mktemp)"; security cms -D -i "$WIDGET_PROFILE_FILE" > "$TMP_PLIST"
  W_UUID="$(/usr/libexec/PlistBuddy -c 'Print :UUID' "$TMP_PLIST")"
  W_APPID="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:application-identifier' "$TMP_PLIST")"
  rm -f "$TMP_PLIST"
  [ "$W_APPID" = "$TEAM.$WIDGET_BUNDLE" ] || fail "widget profile is for '$W_APPID', expected '$TEAM.$WIDGET_BUNDLE'"
  cp -f "$WIDGET_PROFILE_FILE" "$PROFILES_DIR/$W_UUID.mobileprovision"
  ok "widget profile $WIDGET_PROFILE_NAME ($W_APPID) installed ($W_UUID)"
fi

say "3/5 Native project"
[ -d "$IOS/Seshat.xcworkspace" ] || fail "ios/ is missing: run  npx expo prebuild --platform ios  then  cd ios && pod install"
if [ -f "$IOS/Pods/Manifest.lock" ] && ! diff -q "$IOS/Podfile.lock" "$IOS/Pods/Manifest.lock" >/dev/null; then
  fail "Pods are out of sync: run  cd ios && pod install"
fi
ok "workspace + Pods in sync"

# Release signing for the app target only (never the Pods): Apple Distribution, the
# App Store profile, and a production push entitlement. Works on a freshly
# generated project (which has no manual-signing settings) and is idempotent.
python3 - "$IOS" "$PROFILE_NAME" "$TEAM" "$BUNDLE" "$WIDGET_PROFILE_NAME" "$HAS_WIDGET" <<'PY'
import re, sys
ios, profile, team, bundle, widget_profile, has_widget = sys.argv[1:7]
ent_dev = f"{ios}/Seshat/Seshat.entitlements"
ent_rel = f"{ios}/Seshat/SeshatRelease.entitlements"
open(ent_rel, "w").write(open(ent_dev).read().replace("<string>development</string>", "<string>production</string>"))
p = f"{ios}/Seshat.xcodeproj/project.pbxproj"
s = open(p).read()
KEYS = ("CODE_SIGN_STYLE", "DEVELOPMENT_TEAM", "CODE_SIGN_ENTITLEMENTS", 'CODE_SIGN_IDENTITY', '"CODE_SIGN_IDENTITY[sdk=iphoneos*]"', '"PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]"', "PROVISIONING_PROFILE_SPECIFIER")

def release_block(bundle_id):
    """The Release build configuration whose PRODUCT_BUNDLE_IDENTIFIER is exactly bundle_id."""
    blocks = re.findall(r"(\t\t[0-9A-Z]{24} /\* Release \*/ = \{\n\t\t\tisa = XCBuildConfiguration;.*?\n\t\t\};)", s, re.S)
    hit = [b for b in blocks if "INFOPLIST_FILE" in b and re.search(r"PRODUCT_BUNDLE_IDENTIFIER = \"?" + re.escape(bundle_id) + r"\"?;", b)]
    assert len(hit) == 1, f"expected one Release block for {bundle_id}, found {len(hit)}"
    return hit[0]

def sign(blk, profile_name, entitlements=None):
    new = blk
    for key in KEYS:
        if key == "CODE_SIGN_ENTITLEMENTS" and entitlements is None:
            continue  # the widget keeps the entitlements file the plugin generated
        new = re.sub(r"\n\t\t\t\t" + re.escape(key) + r" = [^;]*;", "", new)
    settings = ["CODE_SIGN_STYLE = Manual;", f"DEVELOPMENT_TEAM = {team};"]
    if entitlements:
        settings.append(f"CODE_SIGN_ENTITLEMENTS = {entitlements};")
    settings += ['"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";',
                 f'"PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]" = "{profile_name}";']
    inject = "".join("\n\t\t\t\t" + x for x in settings)
    return new.replace("buildSettings = {", "buildSettings = {" + inject, 1)

changed = False
blk = release_block(bundle)
new = sign(blk, profile, "Seshat/SeshatRelease.entitlements")
if new != blk:
    s = s.replace(blk, new); changed = True
if has_widget == "1":
    blk = release_block(bundle + ".widget")
    new = sign(blk, widget_profile)
    if new != blk:
        s = s.replace(blk, new); changed = True
if changed:
    open(p, "w").write(s)
    print("  set Release signing")
else:
    print("  Release signing already set")
PY
ok "Release = Apple Distribution + $PROFILE_NAME + production push"
[ "$HAS_WIDGET" = 1 ] && ok "widget extension signed with $WIDGET_PROFILE_NAME"

# Expo writes CFBundleVersion / CFBundleShortVersionString as literals, so the
# xcodebuild overrides below would be ignored and every upload would be build "1"
# (App Store Connect needs a higher build number each time). Point them at the
# build settings instead.
for pair in "CFBundleVersion:\$(CURRENT_PROJECT_VERSION)" "CFBundleShortVersionString:\$(MARKETING_VERSION)"; do
  key="${pair%%:*}"; val="${pair#*:}"
  /usr/libexec/PlistBuddy -c "Set :$key $val" "$IOS/Seshat/Info.plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :$key string $val" "$IOS/Seshat/Info.plist"
done
ok "version + build number come from the build settings"

[ "$MODE" = "--check" ] && { say "All checks passed. Run without --check to build."; exit 0; }

say "4/5 Archive (this takes several minutes)"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%y%m%d%H%M)}"
VERSION="$(python3 -c "import json;print(json.load(open('$ROOT/app.json'))['expo']['version'])")"
rm -rf "$ARCHIVE"; mkdir -p "$BUILD_DIR"
xcodebuild -workspace "$IOS/Seshat.xcworkspace" -scheme Seshat -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  archive | { command -v xcpretty >/dev/null && xcpretty || cat; }
ok "archive  v$VERSION ($BUILD_NUMBER)"

say "5/5 Export App Store .ipa"
WIDGET_EXPORT_ENTRY=""
[ "$HAS_WIDGET" = 1 ] && WIDGET_EXPORT_ENTRY="<key>$WIDGET_BUNDLE</key><string>$WIDGET_PROFILE_NAME</string>"
cat > "$BUILD_DIR/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key><dict><key>$BUNDLE</key><string>$PROFILE_NAME</string>$WIDGET_EXPORT_ENTRY</dict>
  <key>uploadSymbols</key><true/>
  <key>stripSwiftSymbols</key><true/>
</dict></plist>
PLIST
rm -rf "$EXPORT_DIR"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" -exportPath "$EXPORT_DIR"
IPA="$(ls "$EXPORT_DIR"/*.ipa | head -1)"
ok "$IPA"

if [ "$MODE" = "--upload" ]; then
  : "${ASC_API_KEY:?set ASC_API_KEY (App Store Connect API key id)}"
  : "${ASC_API_ISSUER:?set ASC_API_ISSUER (issuer id)}"
  say "Uploading to App Store Connect"
  xcrun altool --upload-app -f "$IPA" -t ios --apiKey "$ASC_API_KEY" --apiIssuer "$ASC_API_ISSUER"
  ok "uploaded: it appears in TestFlight after Apple finishes processing (10-30 min)"
else
  echo
  echo "Next: open the Transporter app (free on the Mac App Store), sign in with an Apple ID that has"
  echo "upload rights on team $TEAM, and drag in:  $IPA"
fi
