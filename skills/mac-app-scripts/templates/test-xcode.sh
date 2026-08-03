#!/usr/bin/env bash
# name: test
# description: Run the test suite with xcodebuild
# created: @@DATE@@
#
# Usage:
#   ./scripts/test.sh                       # every test
#   ./scripts/test.sh ThingTests/aCase      # anything else becomes -only-testing:
set -euo pipefail

cd "$(dirname "$0")/.."

SCHEME="@@SCHEME@@"
DERIVED=".build/DerivedData"

if compgen -G "*.xcworkspace" >/dev/null; then
    CONTAINER=(-workspace "$(ls -d *.xcworkspace | head -1)")
else
    CONTAINER=(-project "$(ls -d *.xcodeproj | head -1)")
fi

ONLY=()
[ $# -gt 0 ] && ONLY=(-only-testing:"$1")

xcodebuild "${CONTAINER[@]}" \
    -scheme "$SCHEME" \
    -destination 'platform=macOS' \
    -derivedDataPath "$DERIVED" \
    "${ONLY[@]}" \
    test
