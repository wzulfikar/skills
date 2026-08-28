# wildan-skills skill

Find and run a skill from this repo that isn't installed. It exists so a one-off
skill can stay out of every session's context and still be reachable by name in
plain English.

## The problem it solves

An installed skill puts its `description` — not its body — into context on every
session, whether or not it ever fires. Around 130 tokens each.

That is a fair price for something reached for weekly. It is a bad price for
`opennext-cf-env-files`, which sets up env files once per codebase and then
never again. But the alternative, leaving it uninstalled, means nothing
advertises it: you have to remember it exists and type its full path.

`wildan-skills` is the one installed skill that knows where the others are. One
description in context covers every uninstalled skill in the repo.

## Using it

Ask for it the way you'd ask a person:

```
use wildan's skill to add opennext env files on cf
```

No path, no exact skill name. Anything that refers to a skill of yours without
naming a file works — "use my skill for ...", "do I have a skill for this",
"check my skills repo".

What happens next:

| Step | What runs |
| --- | --- |
| 1 | `bin/skills-index opennext env` — every query word must match |
| 2 | The match prints as name, absolute path, full description |
| 3 | The agent reads that `SKILL.md` and follows it as if invoked directly |

Step 3 is the point: an uninstalled skill behaves exactly like an installed one
once it's been found. Its relative references — `templates/`, `scripts/`,
`references/` — resolve against the skill's own directory, not your project.

## The script by hand

```bash
./bin/skills-index                # every skill: name, path, description
./bin/skills-index opennext env   # only skills matching all of those words
./bin/skills-index --show devbar  # just the path to one SKILL.md
```

Matching is case-insensitive and AND-ed: a skill has to contain *every* word you
pass, in its name or its description. No match exits non-zero rather than
guessing at something adjacent.

Folders with no `SKILL.md` are skipped, so the empty placeholder directories in
`skills/` stay invisible until they have content.

## Match quality is the description's job

`skills-index` searches names and descriptions only — never skill bodies. A
skill whose description is one thin line will not be found by a query phrased in
words it doesn't contain.

So a one-off skill needs a *better* description than an installed one, not a
worse one. Write the trigger phrases people would actually say into it:

```yaml
description: Set up typed, validated environment variables for a Next.js app
  deployed to Cloudflare Workers via OpenNext — ... Use for "set up env vars for
  opennext", "env validation on cloudflare", "my NEXT_PUBLIC var is undefined in
  production", "add an env var to this app".
```

That skill is findable by `env`, `opennext`, `cloudflare`, `validation`,
`secrets` or `NEXT_PUBLIC`. A skill described as "env setup" is findable by
almost nothing.

## When to stop looking one up

Lookup is two hops — find, then read. If you're reaching for the same skill
every week, that cost has stopped being worth avoiding:

```bash
./install.sh opennext-cf-env-files
```

Now its own description is in context each session and it fires directly, with
no index in between. Reverse it by deleting the symlink in `~/.claude/skills`.

Rough line: install anything used more than about once a month, look up the
rest.

## Adding a one-off skill

Write it under `skills/<name>/SKILL.md` like any other, then *don't* install it.
`skills-index` picks it up on the next run — there is no list to register in.

One thing to keep current: the `wildan-skills` description names the topics of
the uninstalled skills, so a request lands on this index in the first place. Add
a keyword there when you add a skill in a genuinely new area.

## Installation

```bash
npx skills add wzulfikar/skills --skill wildan-skills
```

This skill is the exception to its own rule — it only works installed, since
something has to be in context to point at everything else.

It also assumes the repo is cloned at `~/code/github/skills`; the paths in
`SKILL.md` are absolute. Clone it elsewhere and those need editing.
