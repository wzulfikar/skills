#!/usr/bin/env bash
# name: scaffold
# description: Write the standard build scripts and .work/ shims into a Mac app repo
# created: 2026-08-04
#
# Usage:
#   scaffold.sh --repo <path> --app "Thing" --bundle Thing \
#               --bundle-id dev.wzulfikar.thing --kind spm|xcode \
#               [--scheme Thing] [--min-macos 14.0] [--no-bundle] [--force]
#
# Existing files are never overwritten without --force; .work/ shims always are,
# because they are one line each and gitignored, so a fresh clone has none.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$HERE/templates"

REPO="" APP="" BUNDLE="" BUNDLE_ID="" KIND="" SCHEME=""
MIN_MACOS="14.0" WANT_BUNDLE=1 FORCE=0

while [ $# -gt 0 ]; do
    case "$1" in
        --repo)       REPO="$2"; shift 2 ;;
        --app)        APP="$2"; shift 2 ;;
        --bundle)     BUNDLE="$2"; shift 2 ;;
        --bundle-id)  BUNDLE_ID="$2"; shift 2 ;;
        --kind)       KIND="$2"; shift 2 ;;
        --scheme)     SCHEME="$2"; shift 2 ;;
        --min-macos)  MIN_MACOS="$2"; shift 2 ;;
        --no-bundle)  WANT_BUNDLE=0; shift ;;
        --force)      FORCE=1; shift ;;
        -h|--help)    sed -n '5,12p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

for required in REPO APP BUNDLE BUNDLE_ID KIND; do
    [ -n "${!required}" ] || { echo "error: --${required//_/-} is required" >&2; exit 2; }
done
case "$KIND" in
    spm|xcode) ;;
    *) echo "error: --kind must be spm or xcode" >&2; exit 2 ;;
esac
if [ "$KIND" = xcode ] && [ -z "$SCHEME" ]; then
    echo "error: --kind xcode needs --scheme (see: xcodebuild -list)" >&2
    exit 2
fi

REPO="$(cd "${REPO/#\~/$HOME}" && pwd)"
[ -d "$REPO" ] || { echo "error: no such directory: $REPO" >&2; exit 1; }

# The bundle name has to match what the build actually produces, or the .app
# gets an executable that isn't there and launches into nothing.
if [ "$KIND" = spm ] && [ -f "$REPO/Package.swift" ]; then
    grep -q "\"$BUNDLE\"" "$REPO/Package.swift" \
        || echo "warning: '$BUNDLE' is not named in Package.swift — check the product name"
fi

mkdir -p "$REPO/scripts" "$REPO/.work"

render() {   # render <template> <destination> <mode>
    local src="$TEMPLATES/$1" dest="$REPO/$2" mode="$3"
    if [ -e "$dest" ] && [ "$FORCE" = 0 ]; then
        echo "  kept    $2 (exists; --force to replace)"
        return
    fi
    sed -e "s|@@APP@@|$APP|g" \
        -e "s|@@BUNDLE@@|$BUNDLE|g" \
        -e "s|@@BUNDLE_ID@@|$BUNDLE_ID|g" \
        -e "s|@@SCHEME@@|$SCHEME|g" \
        -e "s|@@MIN_MACOS@@|$MIN_MACOS|g" \
        -e "s|@@DATE@@|$(date +%Y-%m-%d)|g" \
        "$src" > "$dest"
    chmod "$mode" "$dest"
    echo "  wrote   $2"
}

echo "scaffolding $APP ($KIND) in $REPO"

if [ "$KIND" = spm ]; then
    render build-spm.sh  scripts/build.sh 755
    render test-spm.sh   scripts/test.sh  755
else
    render build-xcode.sh scripts/build.sh 755
    render test-xcode.sh  scripts/test.sh  755
fi
render dev      scripts/dev      755
render clean.sh scripts/clean.sh 755
[ "$WANT_BUNDLE" = 1 ] && render bundle.sh scripts/bundle.sh 755

# Shims. Always rewritten: one line each, and gitignored, so a clone has none.
shim() {   # shim <name> <command>
    printf '#!/bin/sh\n%s\n' "$2" > "$REPO/.work/$1"
    chmod 755 "$REPO/.work/$1"
    echo "  wrote   .work/$1"
}
shim build 'exec ./scripts/build.sh "$@"'
shim dev   'exec ./scripts/dev "$@"'
shim test  'exec ./scripts/test.sh "$@"'
shim clean 'exec ./scripts/clean.sh'
shim start "exec open build/$BUNDLE.app"
[ "$WANT_BUNDLE" = 1 ] && shim bundle 'exec ./scripts/bundle.sh "$@"'
[ -e "$REPO/.work/notes.md" ] || { : > "$REPO/.work/notes.md"; echo "  wrote   .work/notes.md"; }

# dist/ is new to the repo if bundle.sh was written; build products should never
# be committed.
if [ -f "$REPO/.gitignore" ]; then
    for pattern in .build/ build/ dist/; do
        grep -qx -- "$pattern" "$REPO/.gitignore" || {
            printf '%s\n' "$pattern" >> "$REPO/.gitignore"
            echo "  added   $pattern to .gitignore"
        }
    done
fi

cat <<DONE

done. from $REPO:
  work dev      build and relaunch
  work build    [--release]
  work test
$([ "$WANT_BUNDLE" = 1 ] && echo "  work bundle   [--notarize]")
  work clean

next: document types and app-specific build steps go in scripts/build.sh —
see the Info.plist heredoc and the '# app-specific' marker.
DONE
