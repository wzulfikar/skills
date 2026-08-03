#!/usr/bin/env bash
# name: build
# description: Build @@APP@@ with xcodebuild and copy the bundle to build/
# created: @@DATE@@
#
# Usage:
#   ./scripts/build.sh            # Debug   -> build/@@BUNDLE@@.app
#   ./scripts/build.sh --release  # Release -> same path
#
# Xcode already produces a real bundle, so this only builds and puts the result
# somewhere predictable — derived data moves, build/ doesn't.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEME="@@SCHEME@@"
APP="$ROOT/build/@@BUNDLE@@.app"
DERIVED="$ROOT/.build/DerivedData"

CONFIG="Debug"
for arg in "$@"; do
    case "$arg" in
        --release) CONFIG="Release" ;;
        --debug)   CONFIG="Debug" ;;
        *)
            echo "usage: $0 [--release|--debug]" >&2
            exit 2
            ;;
    esac
done

# A workspace wins when both exist — it is the one that carries the packages.
if compgen -G "$ROOT/*.xcworkspace" >/dev/null; then
    CONTAINER=(-workspace "$(ls -d "$ROOT"/*.xcworkspace | head -1)")
else
    CONTAINER=(-project "$(ls -d "$ROOT"/*.xcodeproj | head -1)")
fi

echo "==> building $SCHEME ($CONFIG)"
xcodebuild "${CONTAINER[@]}" \
    -scheme "$SCHEME" \
    -configuration "$CONFIG" \
    -derivedDataPath "$DERIVED" \
    CODE_SIGN_IDENTITY="${CODESIGN_IDENTITY:--}" \
    build

BUILT="$DERIVED/Build/Products/$CONFIG/@@BUNDLE@@.app"
[ -d "$BUILT" ] || { echo "error: xcodebuild produced no $BUILT" >&2; exit 1; }

echo "==> copying to $APP"
mkdir -p "$ROOT/build"
rm -rf "$APP"
cp -R "$BUILT" "$APP"

# app-specific: extra resources or post-processing go here.

# Rebuilding in place leaves LaunchServices holding the bundle it saw last, and
# the first `open` after a build then starts an app with no window. Re-register.
LSREG=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
[ -x "$LSREG" ] && "$LSREG" -f "$APP"

echo
echo "built $APP ($CONFIG)"
echo "  open: open '$APP'"
