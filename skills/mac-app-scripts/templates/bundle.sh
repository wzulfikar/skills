#!/usr/bin/env bash
# name: bundle
# description: Package a release build into dist/@@BUNDLE@@.dmg
# created: @@DATE@@
#
# Usage:
#   ./scripts/bundle.sh              # release build -> dmg (ad-hoc signed)
#   ./scripts/bundle.sh --no-build   # dmg from build/@@BUNDLE@@.app as it stands
#   ./scripts/bundle.sh --notarize   # ... and notarize + staple
#
# Signing: export CODESIGN_IDENTITY="Developer ID Application: … (TEAMID)".
# Without it the app is ad-hoc signed, which is fine on this Mac and refused by
# Gatekeeper on anyone else's.
#
# Notarizing also needs, in the environment:
#   APPLE_ID, APPLE_ID_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
set -euo pipefail

cd "$(dirname "$0")/.."

APP="build/@@BUNDLE@@.app"
DMG="dist/@@BUNDLE@@.dmg"
VOLNAME="@@APP@@"

BUILD=1
NOTARIZE=0
for arg in "$@"; do
    case "$arg" in
        --no-build) BUILD=0 ;;
        --notarize) NOTARIZE=1 ;;
        *)
            echo "usage: $0 [--no-build] [--notarize]" >&2
            exit 2
            ;;
    esac
done

if [ "$NOTARIZE" = 1 ]; then
    : "${APPLE_ID:?--notarize needs APPLE_ID}"
    : "${APPLE_ID_APP_SPECIFIC_PASSWORD:?--notarize needs APPLE_ID_APP_SPECIFIC_PASSWORD}"
    : "${APPLE_TEAM_ID:?--notarize needs APPLE_TEAM_ID}"
    # Notarization rejects ad-hoc signatures outright — fail now, not in ten minutes.
    if [ -z "${CODESIGN_IDENTITY:-}" ]; then
        echo "error: --notarize needs a Developer ID in CODESIGN_IDENTITY" >&2
        exit 1
    fi
fi

if [ "$BUILD" = 1 ]; then
    ./scripts/build.sh --release
elif [ ! -d "$APP" ]; then
    echo "error: no $APP — drop --no-build" >&2
    exit 1
fi

mkdir -p dist
rm -f "$DMG"

if [ "$NOTARIZE" = 1 ]; then
    echo "==> notarizing the app"
    ZIP="$(mktemp -d)/app.zip"
    ditto -c -k --keepParent "$APP" "$ZIP"
    xcrun notarytool submit "$ZIP" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_ID_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" \
        --wait
    xcrun stapler staple "$APP"
fi

echo "==> building $DMG"
STAGE="$(mktemp -d)/dmg"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "$VOLNAME" -srcfolder "$STAGE" -ov -format ULFO "$DMG" >/dev/null

if [ -n "${CODESIGN_IDENTITY:-}" ]; then
    codesign --force --sign "$CODESIGN_IDENTITY" "$DMG"
fi

if [ "$NOTARIZE" = 1 ]; then
    echo "==> notarizing the dmg"
    xcrun notarytool submit "$DMG" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_ID_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" \
        --wait
    xcrun stapler staple "$DMG"
fi

echo
echo "built $DMG"
[ "$NOTARIZE" = 1 ] || echo "  not notarized — local testing only"
