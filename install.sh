#!/usr/bin/env bash
# name: install
# description: Symlink skills from this repo into ~/.claude/skills
# created: 2026-08-04
#
# Usage:
#   ./install.sh                 # every skill in skills/
#   ./install.sh mac-app-scripts # just that one
#   ./install.sh --list          # what is here, and what is linked
#
# Symlinks rather than copies: edit a skill here and the change is live, and
# `git status` in this repo is the truth about what a skill says.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$HOME/.claude/skills"

if [ "${1:-}" = "--list" ]; then
    for dir in "$ROOT"/skills/*/; do
        name="$(basename "$dir")"
        link="$TARGET/$name"
        if [ -L "$link" ]; then
            state="linked"
        elif [ -e "$link" ]; then
            state="a real directory is in the way"
        else
            state="not installed"
        fi
        printf '%-24s %s\n' "$name" "$state"
    done
    exit 0
fi

names=("$@")
if [ ${#names[@]} -eq 0 ]; then
    names=()
    for dir in "$ROOT"/skills/*/; do names+=("$(basename "$dir")"); done
fi

mkdir -p "$TARGET"
for name in "${names[@]}"; do
    source="$ROOT/skills/$name"
    link="$TARGET/$name"
    [ -d "$source" ] || { echo "no such skill: $name" >&2; exit 1; }

    # A real directory there is somebody's own skill of the same name. Replacing
    # it would delete work that isn't in any repo.
    if [ -e "$link" ] && [ ! -L "$link" ]; then
        echo "skipped $name — $link exists and is not a symlink" >&2
        continue
    fi
    rm -f "$link"
    ln -s "$source" "$link"
    echo "linked  $name"
done
