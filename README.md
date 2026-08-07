# Skills

Agent skills, kept in one repo instead of loose in `~/.claude/skills`. Each is a
folder with a `SKILL.md` and whatever it needs to actually do the work —
templates, scripts, reference files.

```bash
./install.sh                  # symlink every skill into ~/.claude/skills
./install.sh mac-app-scripts  # just one
./install.sh --list           # what is here, and what is linked
```

Symlinks, not copies. Edit a skill here and the change is live in the next
session; `git status` stays the truth about what a skill says. `install.sh`
refuses to replace a real directory of the same name, since that would be
somebody's own skill and it lives nowhere else.

## Updating an installed skill

If it was installed with the `skills` CLI (`npx skills add wzulfikar/skills`),
the files were **copied** into `~/.agents/skills/<name>` and symlinked into each
agent's directory. A `git pull` here changes nothing for them:

```bash
npx skills update agents-queue   # or bare `update` for all of them
```

`~/.agents/.skill-lock.json` records the folder hash it installed, so `update`
knows whether there is anything to fetch. Push to GitHub before expecting anyone
— including yourself — to get a change.

If it was installed with `./install.sh`, it is a symlink into this repo and a
`git pull` is the whole update. The two mechanisms both write
`~/.claude/skills/<name>`, so running `install.sh` over a CLI-installed skill
repoints the symlink at this repo and leaves the copy in `~/.agents` orphaned —
fine, but `npx skills update` will then be updating something nothing points at.

**A skill update does not touch what it already scaffolded.** `agents-queue`
writes prompt files into a target repo; those are copies from the moment they
land. Re-run the scaffold to bring one up to date:

```bash
skills/agents-queue/scripts/init.sh --repo ~/code/thing --force
```

`--force` rewrites the prompt files and leaves task files alone, but it also
overwrites anything customised in them — for `agents-queue` that is the
Promotion section at the bottom of `task-worker.md`. Save it first, or diff
after.

## What's here

| Skill | For |
|---|---|
| [`agents-queue`](skills/agents-queue) | Put a reviewed task queue in the repo as `agents-queue/`, so plans get written and read before anything is built — then run the worker on a loop and only do the planning |
| [`github-actions`](skills/github-actions) | Add a workflow from a template that already runs in production — Supabase migrations on push to main, or a deploy — and the secrets, variables and environment it needs |
| [`mac-app-scripts`](skills/mac-app-scripts) | Give a macOS app repo the standard `build`, `dev`, `test`, `bundle`, `clean` scripts and the `.work/` shims that make them `work build`, `work dev` |

## Writing one

A skill earns its place when the same work comes up in more than one repo and
getting it right took a while the first time. One-offs belong in the repo they
happened in.

```
skills/<name>/
  SKILL.md      front matter: name, description. Then how to do the thing.
  scripts/      what the skill runs
  templates/    what it writes out
  references/   what it reads
```

The `description` is the whole of what an agent sees before deciding to open the
skill, so it has to say **when to use this**, not only what it is. Name the
triggers — the words someone would actually say.

Keep the body short and put the detail in the files beside it. What belongs in
`SKILL.md` is the order to do things in, the decisions that need making first,
and the traps — the things that cost a debugging session and would otherwise be
rediscovered.
