---
name: github-actions
description: Add a GitHub Actions workflow to a repo from a known-good template — Supabase migrations applied on push to main, or a Vercel deploy for a private repo Vercel will not auto-build — and set up the secrets, variables and environment it needs. Use when someone asks to run migrations on deploy, deploy on push to main, "set up CI for this", add a workflow, or wire up GitHub environments and secrets.
---

# GitHub Actions

Workflows here are copied from ones already running in production, not written
from scratch. Each template is deliberately small: a trigger, an environment, a
few env vars, one command. Everything that makes it work is off in repo settings
where the diff cannot show it — that part is most of this skill.

```
templates/prod_apply_supabase_migration.yml   push to main touching migrations -> supabase migration up
templates/prod_deploy_vercel.yml              push to main touching the app -> build and deploy to Vercel
```

## The deploy workflow is not always wanted

Check the host before scaffolding it. A deploy workflow next to a host that
already deploys on commit means every push builds twice.

- **Vercel, private repo — needed.** Vercel's Git integration does not
  auto-deploy private repos on a plan without it, so the push produces nothing
  and the deploy has to be triggered from Actions. This is what the template is
  for.
- **Vercel, public repo, or a plan with Git integration — not needed.** Vercel
  builds on push already.
- **Cloudflare (`@opennextjs/cloudflare`, Pages, Workers) — not needed.** The
  Workers/Pages Git integration builds on commit for private repos too. Scaffold
  the migration workflow only.

The migration workflow is independent of all of that — it runs against Supabase,
not the host, so it is wanted in every case.

## Do it

```bash
scripts/add-workflow.sh --repo ~/code/klu/thing --workflow supabase-migration
```

`--branch`, `--env`, `--title`, `--as <filename>` and `--migrations-path`
override the defaults (`main`, `production`, and the template's own filename).
It refuses to overwrite without `--force`, and on the way out it prints the
secrets that still have to be set and reads `supabase/config.toml` to name the
env vars that file interpolates.

Then set them, then push, then watch the first run:

```bash
gh secret set SUPABASE_ACCESS_TOKEN --env production
gh secret set SUPABASE_DB_PASSWORD  --env production
gh variable set SUPABASE_PROJECT_ID --env production --body <project-ref>
gh run watch
```

## Decide these before writing the file

| Decision | How to settle it |
|---|---|
| `paths:` filter | The files whose change should cause this run, and no others. A migration workflow with no filter runs on every README commit; a deploy workflow missing a path ships that change silently on someone else's next push. |
| `environment:` | Use one even with no reviewers — environment-scoped secrets, and required reviewers become a checkbox later rather than a rewrite. Deploy and migrate should share it. |
| secret vs variable | Secret if leaking it costs something (tokens, DB passwords). Variable otherwise (project refs, emails) — variables are readable in logs, which is what you want when a run fails. |
| `timeout-minutes` | Always set. The default is 6 hours, and a hung `supabase link` will sit there burning minutes. |

## Traps

Each of these has cost a red run somewhere.

- **`supabase link` parses `config.toml`, so every `env(...)` in it must be set
  in the workflow.** Auth provider secrets are the usual culprit: CI signs
  nobody in, but the parse still fails on a missing var. Set them to
  `dummy-value`. The scaffold greps `config.toml` and lists them.
- **`supabase migration up --linked` applies pending migrations in order.** It
  is not `supabase db push`, which diffs local schema against remote and can
  propose drops. `migration up` is the one that belongs on an automatic trigger.
- **Pushing a workflow file needs the `workflow` scope on the token.** A plain
  `gh auth login` has it; a PAT or `GITHUB_TOKEN` used from another action often
  does not, and the push is rejected with `refusing to allow ... to create or
  update workflow`. `gh auth refresh -s workflow` fixes the local case.
- **A migration workflow and a deploy workflow both triggered by
  `supabase/migrations/**` race.** They start together — the deploy can go out
  against the old schema. Either keep migrations out of the deploy's paths, or
  make the deploy `needs:` the migration in one workflow file.
- **Where the host deploys on commit, that race cannot be fixed with `needs:`.**
  Cloudflare starts its build the moment the push lands, in parallel with the
  migration workflow and outside Actions entirely. A migration that has to land
  before the code either goes out ahead of the merge, or the deploy moves into
  Actions too so the ordering is expressible.
- **`environment:` with required reviewers pauses the job, it does not fail
  it.** The run sits waiting and the timeout does not tick during approval.
- **A branch with no protection means anyone's push to main deploys.** The
  workflow is the last gate, not the first one.

## Adding a new template

Add one when the same workflow has been written twice by hand. Copy the working
file out of the repo it runs in, replace the repo-specific parts with `@@NAME@@`
placeholders, add a `case` branch in `add-workflow.sh` and a `sed -e` line if the
placeholder is new.

Keep templates as real `.yml` files and render them with `sed`. They never
execute from here — only `.github/workflows/` makes YAML a workflow, and
`templates/` is inert. Do not build workflow YAML in a heredoc: it is full of
`${{ ... }}`, and an unquoted heredoc hands all of it to the shell.
