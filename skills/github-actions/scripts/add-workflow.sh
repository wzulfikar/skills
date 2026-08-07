#!/usr/bin/env bash
# name: add-workflow
# description: Write a workflow template into a repo's .github/workflows/, with placeholders filled
# created: 2026-08-06
#
# Usage:
#   add-workflow.sh --repo <path> --workflow <name> [--branch main]
#                   [--env production] [--title "..."] [--as <filename>]
#                   [--migrations-path supabase/migrations] [--force]
#
#   --workflow  supabase-migration | deploy-vercel   (see templates/)
#
# Templates are copied through sed, never a heredoc: workflow YAML is full of
# ${{ ... }} and a heredoc would let the shell eat it.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$HERE/templates"

REPO="" WORKFLOW="" BRANCH="main" ENVIRONMENT="production"
TITLE="" AS="" MIGRATIONS_PATH="supabase/migrations" FORCE=0

while [ $# -gt 0 ]; do
    case "$1" in
        --repo)            REPO="$2"; shift 2 ;;
        --workflow)        WORKFLOW="$2"; shift 2 ;;
        --branch)          BRANCH="$2"; shift 2 ;;
        --env)             ENVIRONMENT="$2"; shift 2 ;;
        --title)           TITLE="$2"; shift 2 ;;
        --as)              AS="$2"; shift 2 ;;
        --migrations-path) MIGRATIONS_PATH="$2"; shift 2 ;;
        --force)           FORCE=1; shift ;;
        -h|--help)         sed -n '5,14p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

[ -n "$REPO" ]     || { echo "error: --repo is required" >&2; exit 2; }
[ -n "$WORKFLOW" ] || { echo "error: --workflow is required" >&2; exit 2; }

case "$WORKFLOW" in
    supabase-migration)
        SRC="prod_apply_supabase_migration.yml"
        : "${TITLE:=Prod: Apply Supabase Migration}" ;;
    deploy-vercel)
        SRC="prod_deploy_vercel.yml"
        : "${TITLE:=Prod: Deploy}" ;;
    *) echo "error: unknown --workflow: $WORKFLOW (supabase-migration | deploy-vercel)" >&2; exit 2 ;;
esac

REPO="$(cd "${REPO/#\~/$HOME}" && pwd)"
git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 \
    || { echo "error: $REPO is not a git repository" >&2; exit 1; }

DEST_NAME="${AS:-$SRC}"
DEST="$REPO/.github/workflows/$DEST_NAME"

if [ -e "$DEST" ] && [ "$FORCE" = 0 ]; then
    echo "kept    .github/workflows/$DEST_NAME (exists; --force to replace)"
    exit 0
fi

mkdir -p "$REPO/.github/workflows"
sed -e "s|@@TITLE@@|$TITLE|g" \
    -e "s|@@BRANCH@@|$BRANCH|g" \
    -e "s|@@ENVIRONMENT@@|$ENVIRONMENT|g" \
    -e "s|@@MIGRATIONS_PATH@@|$MIGRATIONS_PATH|g" \
    "$TEMPLATES/$SRC" > "$DEST"

echo "wrote   .github/workflows/$DEST_NAME"

# Nothing below is optional to check, and none of it is visible in the diff.
if [ "$WORKFLOW" = supabase-migration ]; then
    echo
    echo "still needed on the '$ENVIRONMENT' environment:"
    echo "  gh secret set SUPABASE_ACCESS_TOKEN --env $ENVIRONMENT"
    echo "  gh secret set SUPABASE_DB_PASSWORD  --env $ENVIRONMENT"
    echo "  gh variable set SUPABASE_PROJECT_ID --env $ENVIRONMENT --body <project-ref>"
    if [ -f "$REPO/supabase/config.toml" ]; then
        grep -o 'env(\([A-Z_]*\))' "$REPO/supabase/config.toml" 2>/dev/null \
            | sed 's/env(\(.*\))/\1/' | sort -u \
            | while read -r v; do
                echo "  config.toml interpolates \$$v — it must be set in the workflow env"
            done
    fi
fi
