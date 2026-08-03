#!/usr/bin/env bash
# name: build
# description: Build @@APP@@ and assemble @@BUNDLE@@.app
# created: @@DATE@@
#
# Usage:
#   ./scripts/build.sh            # debug   -> build/@@BUNDLE@@.app (fast loop)
#   ./scripts/build.sh --release  # release -> same path, optimised
#
# SwiftPM produces a bare executable. AppKit will not show a window for one, so
# the GUI only works once it is wrapped in a real bundle with an Info.plist.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/build/@@BUNDLE@@.app"
BUNDLE_ID="@@BUNDLE_ID@@"
VERSION="${VERSION:-1.0}"

CONFIG="debug"
for arg in "$@"; do
    case "$arg" in
        --release) CONFIG="release" ;;
        --debug)   CONFIG="debug" ;;
        *)
            echo "usage: $0 [--release|--debug]" >&2
            exit 2
            ;;
    esac
done
BUILD="$ROOT/.build/$CONFIG"

echo "==> building ($CONFIG)"
swift build -c "$CONFIG" --package-path "$ROOT"

echo "==> assembling $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BUILD/@@BUNDLE@@" "$APP/Contents/MacOS/@@BUNDLE@@"
printf 'APPL????' > "$APP/Contents/PkgInfo"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>@@APP@@</string>
  <key>CFBundleDisplayName</key><string>@@APP@@</string>
  <key>CFBundleExecutable</key><string>@@BUNDLE@@</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>@@MIN_MACOS@@</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
</dict>
</plist>
PLIST

# app-specific: icon rendering, extra resources, embedded frameworks go here, so
# that a release build gets them too.

# Unsigned bundles get quarantined oddly; an ad-hoc signature avoids the worst of
# it. A stable identity in $CODESIGN_IDENTITY is what makes a Keychain "Always
# Allow" decision survive a rebuild.
codesign --force --deep --sign "${CODESIGN_IDENTITY:--}" "$APP" 2>/dev/null \
    || echo "    (signing skipped)"

# Rebuilding in place leaves LaunchServices holding the bundle it saw last, and
# the first `open` after a build then starts an app with no window. Re-register.
LSREG=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
[ -x "$LSREG" ] && "$LSREG" -f "$APP"

echo
echo "built $APP ($CONFIG)"
echo "  open: open '$APP'"
