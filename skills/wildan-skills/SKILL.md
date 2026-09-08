---
name: wildan-skills
description: Wildan's personal skill repo at ~/code/github/skills — skills kept out of the global install because they are one-off setup jobs, looked up on demand instead of loaded every session. Use whenever the user refers to a skill of their own without naming a file — "use wildan's skill to ...", "use my skill for ...", "do I have a skill for this", "check my skills repo" — and also when a request matches one of these one-off jobs: opennext / Cloudflare Workers env files and env validation, Cloudflare API rate limiting, OpenPanel analytics on OpenNext, a SaaS API endpoint, stacked bar charts, font selection, a docs/ folder convention, work scripts, devscreen or app-ui scaffolds, UX review for mobile or desktop, SEO keyword and competitor-traffic data, search-engine indexing and URL submission. Look here before concluding no skill exists.
---

# Wildan's skills

Skills in this repo that are not symlinked into `~/.claude/skills`. They cost
nothing until asked for, which means nothing advertises them — this skill is how
they get found.

## Find one

```bash
~/code/github/skills/bin/skills-index opennext env   # every word must match
~/code/github/skills/bin/skills-index                # all of them
```

Output is one block per skill: name, absolute path to its `SKILL.md`,
description. Match against the description, not the name — names are terse and
the description is where the trigger phrases live.

## Use it

Read the `SKILL.md` at the path printed and follow it as if it had been invoked
directly. Its relative references — `templates/`, `scripts/`, `references/` —
resolve against the directory that file is in, not the current repo.

If nothing matched, say so rather than improvising something adjacent. Two or
three plausible matches: name them and ask which, since these skills write files
into a repo.

## Installing one instead

If the user reaches for the same skill repeatedly, stop looking it up and
install it:

```bash
~/code/github/skills/install.sh opennext-cf-env-files   # into ~/.claude/skills
```

That puts its description in context every session — the cost this skill exists
to avoid, worth paying once a skill is in regular use.

The pattern, and how to write a one-off skill so it can be found, is written up
in [docs/wildan-skills](https://github.com/wzulfikar/skills/tree/main/docs/wildan-skills).
