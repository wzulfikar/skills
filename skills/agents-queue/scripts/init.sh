#!/usr/bin/env bash
# name: init
# description: Create the agents-queue/ structure in a repo — prompts, tasks/, done/
# created: 2026-08-04
#
# Usage:
#   init.sh --repo <path> [--stale-minutes 90] [--force]
#
# Existing files are never overwritten without --force. tasks/ and done/ get a
# .gitkeep each: git does not track empty directories, and a clone whose tasks/
# vanished gives the worker nothing to read.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$HERE/templates"

REPO="" STALE="90" FORCE=0

while [ $# -gt 0 ]; do
    case "$1" in
        --repo)          REPO="$2"; shift 2 ;;
        --stale-minutes) STALE="$2"; shift 2 ;;
        --force)         FORCE=1; shift ;;
        -h|--help)       sed -n '5,11p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

[ -n "$REPO" ] || { echo "error: --repo is required" >&2; exit 2; }
case "$STALE" in
    ''|*[!0-9]*) echo "error: --stale-minutes must be a number" >&2; exit 2 ;;
esac

REPO="$(cd "${REPO/#\~/$HOME}" && pwd)"
[ -d "$REPO" ] || { echo "error: no such directory: $REPO" >&2; exit 1; }

# The whole protocol claims tasks by committing frontmatter and commits per task.
# Outside a repo none of that means anything.
git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 \
    || echo "warning: $REPO is not a git repository — the worker claims tasks by committing them"

QUEUE="$REPO/agents-queue"
mkdir -p "$QUEUE/tasks" "$QUEUE/done"

render() {   # render <template> <destination>
    local src="$TEMPLATES/$1" dest="$QUEUE/$1"
    if [ -e "$dest" ] && [ "$FORCE" = 0 ]; then
        echo "  kept    agents-queue/$1 (exists; --force to replace)"
        return
    fi
    sed -e "s|@@STALE@@|$STALE|g" "$src" > "$dest"
    echo "  wrote   agents-queue/$1"
}

echo "creating agents-queue/ in $REPO"

render README.md
render plan.md
render task-worker.md

for dir in tasks done; do
    keep="$QUEUE/$dir/.gitkeep"
    [ -e "$keep" ] || { : > "$keep"; echo "  wrote   agents-queue/$dir/.gitkeep"; }
done

cat <<DONE

done. the two folders are the state: tasks/ is live, done/ is finished.

  /agents-queue plan         turn a conversation into tasks/NN-name.md
  /agents-queue              claim the next ready task and implement it
  /loop /agents-queue        self-paced, while you are around
  /loop 10m /agents-queue    fixed interval, for unattended runs

a finished task keeps its Outcome in done/ and is never deleted. a claim older
than $STALE minutes is treated as a dead session and reclaimed — raise it in
task-worker.md if tasks here run longer.

Tip: a finished task often contains something worth keeping outside the queue —
a decision worth recording as an ADR, a requirement as a PRD, a flow someone has
to click through as a UAT script. The worker can write those on completion, but
only once it is told where they go. That is the Promotion section at the bottom
of task-worker.md, and it ships empty: where such docs live is a property of
this repo, and a guess produces a folder nobody asked for.

next: read agents-queue/README.md, then write the first plan. nothing gets
implemented until a task file has been reviewed by a human.
DONE
