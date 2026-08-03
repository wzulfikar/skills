#!/usr/bin/env bash
# name: clean
# description: Remove build products (.build, build/, dist/)
# created: @@DATE@@
#
# Only generated artifacts — everything here is reproduced by ./scripts/build.sh.
set -euo pipefail

cd "$(dirname "$0")/.."

for d in .build build dist; do
    if [ -e "$d" ]; then
        echo "removing $d/"
        rm -rf "$d"
    fi
done
echo "clean."
