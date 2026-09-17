# Orchestrator–executor: Claude with subagents

How I run Claude Code: one big model that plans and reviews, and cheaper
subagents that do the work. This isn't a skill. It's the setup the skills in
this repo get used from.

## The setup

| Piece | Where | What it does |
| --- | --- | --- |
| Main model | Opus 5, every session | Plans, decides, sends work out, reviews what comes back |
| `coder` | `~/.claude/agents/coder.md` | Writes code from a plan that's already decided |
| `researcher` | `~/.claude/agents/researcher.md` | Gathers outside evidence: search demand, SERPs, competitors, social |
| `analyst` | `~/.claude/agents/analyst.md` | Measures inside the product: OpenPanel traffic and events, Autumn billing |
| Routing rules | `~/.claude/rules/coder-subagent.md`, `~/.claude/rules/research-analyst.md` | Tell Opus when to delegate and how to hand off |

All three subagents run on Sonnet 5, pinned in their frontmatter.

I don't pick a subagent myself. I start a chat with Opus, ask for what I want,
and Opus decides whether to send the work out.

## Why it works

**Opus orchestrates:** plan → send to agents → review. Its context stays on
the problem, not on file edits or API output.

**Subagents execute.** Each one has one job, a narrow tool list, and no say in
the decision:

- `coder` builds the plan. It doesn't redesign it.
- `researcher` returns evidence. It doesn't decide what to write.
- `analyst` returns numbers with date ranges. It doesn't decide what they mean.

The result is a balance: **quality from Opus** doing the thinking, **cost from
Sonnet** doing the volume. Most tokens in a task are spent reading files,
writing code, and calling APIs, and that's the part that runs on the cheaper
model.

## Why the rules exist

An agent file alone isn't enough. Claude Code's default is to spawn subagents
only when you ask for one. The agent's description can say "use PROACTIVELY",
but the harness default still wins.

A rule file in `~/.claude/rules/` is my own instruction, loaded in full every
session, so it overrides that default. It works as a standing "yes, delegate".

What loads when:

| | Every session | Only when spawned |
| --- | --- | --- |
| Rule file | whole file, in Opus's context | n/a |
| Agent file | name, description, tools | body, as the subagent's own system prompt |

The agent body never enters Opus's context, so it can be long without costing
the main session anything.

## Routing

| Question | Goes to |
| --- | --- |
| "Implement / fix / refactor / migrate / test this" | `coder` |
| "What should we write or build?" / keywords / competitors / what people say | `researcher` |
| "What converts?" / "Did it work?" / "Who pays for what?" | `analyst` |
| Needs both sides, e.g. "what should the next blog post be?" | `researcher` + `analyst` in parallel, then Opus weighs them |

The same tool can belong to either agent depending on the question. Social
search for topics is researcher work. Checking mentions of our own posts is
analyst work.

Opus does the work itself when:

- I say "do it yourself" or "don't delegate"
- the change is a couple of lines, or it's one quick lookup
- it's exploration or debugging, where each step depends on the last output

## The handoff

Subagents start cold, with no conversation history. The prompt is everything
they get, so the rules require Opus to put the whole plan in it:

- **coder:** file paths, the decision and why, interfaces to match, how to
  verify
- **researcher:** product, question, location and language, brief path
- **analyst:** project root to run from, question, date range, brief path

Each agent is told to stop and say what's missing instead of guessing.

Content work shares a brief at `briefs/<topic>.md` in the project. The
researcher fills demand and voice (`keyword`, `volume`, `difficulty`,
`serp_notes`, `social_signal`). The analyst fills `target_feature`,
`baseline`, and later `result` and `social_reach`.

## Keys

The two data agents load keys differently on purpose:

| Agent | Scripts | Keys from | Why |
| --- | --- | --- | --- |
| `researcher` | `dataforseo`, `socialdata`, `socialcrawl` | environment, then `~/manager/.envrc` | One shared account everywhere |
| `analyst` | `openpanel`, `autumn` | `./.env.local`, `./.env`, `./.envrc`, then environment | Each project may have its own instance |

The analyst's scripts print which file their keys came from, so a report always
says which instance it measured. The Autumn script is read-only and refuses any
call that could change billing.

The agents point at skills in this repo by absolute path (e.g.
`~/code/github/skills/skills/openpanel-query/SKILL.md`) instead of preloading
them with the `skills:` frontmatter field. Preloading needs installed skills,
and installing puts their descriptions in every session. See
[wildan-skills](../wildan-skills).

## Tradeoffs

- **Cold handoffs cost tokens.** A subagent re-reads files Opus already saw.
  That's worth it for real work and wasteful for small edits, which is why the
  rules exclude small edits.
- **Review is still Opus's job.** A subagent's report is a claim. Opus checks
  the diff, the numbers, or the sources before passing them on.
- **Agents load at session start.** A new or edited agent file shows up in the
  next session.
