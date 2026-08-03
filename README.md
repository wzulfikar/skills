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

## What's here

| Skill | For |
|---|---|
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
