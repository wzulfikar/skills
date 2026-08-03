#!/usr/bin/env bash
# name: test
# description: Run the test suite
# created: @@DATE@@
#
# Usage:
#   ./scripts/test.sh              # every test, debug
#   ./scripts/test.sh --release    # same, optimised (catches release-only bugs)
#   ./scripts/test.sh SomeTests    # anything else is passed to --filter
set -euo pipefail

cd "$(dirname "$0")/.."

CONFIG="debug"
FILTER=""
for arg in "$@"; do
    case "$arg" in
        --release) CONFIG="release" ;;
        --debug)   CONFIG="debug" ;;
        -*)
            echo "usage: $0 [--release|--debug] [filter]" >&2
            exit 2
            ;;
        *) FILTER="$arg" ;;
    esac
done

if [ -n "$FILTER" ]; then
    swift test -c "$CONFIG" --filter "$FILTER"
else
    swift test -c "$CONFIG"
fi
