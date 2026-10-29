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

say "3/5 Native project"
[ -d "$IOS/Seshat.xcworkspace" ] || fail "ios/ is missing: run  npx expo prebuild --platform ios  then  cd ios && pod install"
if [ -f "$IOS/Pods/Manifest.lock" ] && ! diff -q "$IOS/Podfile.lock" "$IOS/Pods/Manifest.lock" >/dev/null; then
  fail "Pods are out of sync: run  cd ios && pod install"
fi
ok "workspace + Pods in sync"

# Release signing for the app target only (never the Pods): Apple Distribution, the
# App Store profile, and a production push entitlement. Works on a freshly
# generated project (which has no manual-signing settings) and is idempotent.
python3 - "$IOS" "$PROFILE_NAME" "$TEAM" <<'PY'
import re, sys
ios, profile, team = sys.argv[1], sys.argv[2], sys.argv[3]
ent_dev = f"{ios}/Seshat/Seshat.entitlements"
ent_rel = f"{ios}/Seshat/SeshatRelease.entitlements"
open(ent_rel, "w").write(open(ent_dev).read().replace("<string>development</string>", "<string>production</string>"))
p = f"{ios}/Seshat.xcodeproj/project.pbxproj"
s = open(p).read()
# The app target's Release configuration: the one that sets PRODUCT_BUNDLE_IDENTIFIER and INFOPLIST_FILE.
blocks = re.findall(r"(\t\t[0-9A-F]{24} /\* Release \*/ = \{\n\t\t\tisa = XCBuildConfiguration;.*?\n\t\t\};)", s, re.S)
target = [b for b in blocks if "PRODUCT_BUNDLE_IDENTIFIER" in b and "INFOPLIST_FILE" in b]
assert len(target) == 1, f"expected one app Release block, found {len(target)}"
blk = target[0]
new = blk
for key in ("CODE_SIGN_STYLE", "DEVELOPMENT_TEAM", "CODE_SIGN_ENTITLEMENTS", 'CODE_SIGN_IDENTITY', '"CODE_SIGN_IDENTITY[sdk=iphoneos*]"', '"PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]"', "PROVISIONING_PROFILE_SPECIFIER"):
    new = re.sub(r"\n\t\t\t\t" + re.escape(key) + r" = [^;]*;", "", new)
settings = [
    "CODE_SIGN_STYLE = Manual;",
    f"DEVELOPMENT_TEAM = {team};",
    "CODE_SIGN_ENTITLEMENTS = Seshat/SeshatRelease.entitlements;",
    '"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";',
    f'"PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]" = "{profile}";',
]
inject = "".join("\n\t\t\t\t" + x for x in settings)
new = new.replace("buildSettings = {", "buildSettings = {" + inject, 1)
if new != blk:
    open(p, "w").write(s.replace(blk, new))
    print("  set Release signing")
else:
    print("  Release signing already set")
PY
ok "Release = Apple Distribution + $PROFILE_NAME + production push"

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
cat > "$BUILD_DIR/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key><dict><key>$BUNDLE</key><string>$PROFILE_NAME</string></dict>
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
