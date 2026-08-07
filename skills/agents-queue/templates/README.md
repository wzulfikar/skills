# Agents Queue

A task queue for AI coding agents that lives in the repo. No Linear, no Jira, no
board in another tab — a folder of markdown files, versioned with the code they
describe.

**Human planning, agent implementing.** You decide what gets built and what the
plan for it is; the agent turns approved plans into commits. Neither side does
the other's job — and the folder is where the handoff happens.

The point is not the folder. The point is the **gap between deciding what to
build and building it**. When you brainstorm with an agent and it starts editing
files in the same breath, you get an implementation of the first reading of your
request. This queue puts a written plan in between: the agent researches the
codebase, argues with your premise if the premise is wrong, and writes a task
file. You read it. Then someone — you, a subagent, a loop — implements it.

## Layout

```
agents-queue/
├── plan.md          # prompt: turn the current conversation into a task file
├── task-worker.md   # prompt: pick the next ready task and implement it
├── status.md        # prompt: report the queue, read-only
├── tasks/           # the agent's: reviewed and pickable, or currently running
├── not-ready/       # yours: drafts, open questions, blocked work
└── done/            # finished, with the outcome written at the bottom
```

Three prompt files, three folders. That is the whole system.

**The folder is the state**, and it splits by who has to act next:

| Folder | Whose | Holds |
|---|---|---|
| `tasks/` | the worker's | `ready_for_implementation`, `in_progress` |
| `not-ready/` | yours | `planning`, `waiting_decision`, `blocked` |
| `done/` | nobody's | `done`, with its Outcome |

Every status maps to exactly one folder, so changing a status means moving the
file. The worker reads `tasks/` and nothing else — a plan becomes work when you
move it across, not when a field flips.

That makes `ls not-ready/` the morning check: everything in it is stalled until
someone does something, and the filename says what.

```
$ ls agents-queue/not-ready/
03-oauth-scope.ask-which-tenant-owns-refresh-token.md
05-search-rank.draft.md
07-cdn-purge.blocked-on-INFRA-221.md
```

A parked file carries one extra kebab-case segment naming the reason. The reason
is written in the body too — the filename is the index, not the record — and the
segment comes off when the file moves back to `tasks/`.

For the same picture with the questions spelled out in full, and with anything
odd flagged — a stale claim, a dirty tree, a dependency that will never be
satisfied — call `status.md`. It is read-only and safe to run while a worker is
mid-task.

## The loop

**1. Talk.** Brainstorm the change in a normal session. Don't let the agent
implement it.

**2. Plan.** Call `plan.md`. The agent researches the actual code and writes
`NN-short-description.md` — a self-contained plan with frontmatter. It lands in
`not-ready/` while it is still a draft or still has an open question in it, and
in `tasks/` when it is finished and unambiguous.

**3. Review.** You read the plan. This is the only step that needs a human, and
it is cheap: a plan is a page of prose, not a diff. Wrong plans get edited or
deleted here, before any code exists. Answering the question in a `not-ready/`
file and moving it to `tasks/` is how work gets released to the worker.

**4. Work.** Call `task-worker.md`. It picks one idle task, runs it in a
subagent (each task is self-contained, so a fresh context is enough), and
commits per task.

**5. Record.** The worker appends an **Outcome** section to the task and moves it
to `done/`.

The task file stays there. Nothing is deleted — the plan and its outcome sitting
side by side is the record of what was intended and what was actually built, and
`done/` is where you look to find what a piece of work produced.

If you want the durable part of a task to also land somewhere a person reads
without digging through the queue — a decision as an ADR, a requirement as a PRD
— set the destinations in the Promotion section of `task-worker.md`. It ships
empty on purpose.

## Task file format

Two-digit prefix, kebab-case name, YAML frontmatter, markdown body:

```markdown
---
title: Group the Review Queue by Scan Session
status: ready_for_implementation
created: 2026-08-01
area: api (go + frontend)
risk: medium
touches_config_schema: false
touches_db_schema: true
depends_on: 04-session-store, 06-rate-limiter
---
```

`status` is one of, with the folder each one lives in:

| `status` | Folder | Meaning |
|---|---|---|
| `planning` | `not-ready/` | being written |
| `waiting_decision` | `not-ready/` | needs an answer from you before it can proceed |
| `blocked` | `not-ready/` | waiting on another task or something external |
| `ready_for_implementation` | `tasks/` | reviewed, the worker may pick it up |
| `in_progress` | `tasks/` | a worker has it |
| `done` | `done/` | implemented, with its Outcome written |

The two-digit prefix is unique across all three folders — it is an identifier as
well as a priority, and `depends_on` refers to tasks by name.

`risk` and the `touches_*` flags exist so you can tell at a glance which tasks
deserve a careful read. A schema change and a CSS tweak are not the same review.

`depends_on` is optional and comma-separated. The worker will not pick a task
until every name listed there sits in `done/`, so list a task only when this one
genuinely cannot be built first — a decorative dependency parks the task until
you notice. A dependency in `tasks/` or `not-ready/` is not satisfied, whatever
its status says.

## What a good task looks like

The frontmatter is bookkeeping. The body is the actual product, and it is what
makes this worth more than a checklist:

- **Goal** — what changes and why, in the user's terms.
- **What is true today** — the findings from reading the code, *especially the
  ones that contradict the request*. If the request assumed the list was sorted
  by score and it isn't, that belongs here in bold, because it changes what
  "fixed" means.
- **Decided** — the tradeoffs taken and what they cost. A plan that only records
  the winning option will be re-litigated by the next reader.
- **Steps** — per file, per function, with line references.
- **Verify** — the commands to run, then what to look at in the running app.
- **When done** — anything that has to happen beyond the commit itself.

A task written this way survives being wrong. When the implementation goes
sideways, the reasoning is on the page and you can see which assumption broke.

Once `done/` has a few entries, the best of them is the worked example — point a
newcomer at that rather than explaining this list again.

One more section gets written, but by the worker rather than the planner:

- **Outcome** — appended on completion. What was actually built, the commit, the
  anything it produced, and where it diverged from the plan and why.

Anything written from this task later — a doc, the next task that builds on it —
is written from the Outcome, not from the plan. The plan is what you intended;
only the Outcome says what happened.

## Tip: run the worker on a loop and only do the planning

The queue pays off when you stop being the one who starts each task. Put the
worker on a timer, keep it pointed at `tasks/`, and go back to thinking about
what should be built. Every plan you drop in the folder gets picked up on the
next tick.

Claude Code, self-paced — the delay after each tick comes from queue state:
seconds when a task just finished and more are ready, half an hour when the
queue is empty, stop when everything left is blocked.

```
/loop /agents-queue
```

Claude Code, fixed interval:

```
/loop 10m /agents-queue
```

Codex, or anything with a shell:

```sh
while true; do
  codex exec "$(cat agents-queue/task-worker.md)"
  sleep 600
done
```

**Which of the first two is a correctness question, not a preference.** Self-paced
gives better pacing — a fixed tick both burns no-ops on an empty queue and makes
a task that finished one minute in wait out the rest of the interval. But a
self-paced loop only continues if the turn survives to schedule the next wakeup.
A rate limit landing mid-task ends it silently, and every remaining ready task
sits untouched until morning. A fixed interval is scheduled externally and fires
whether or not the last tick succeeded.

So: self-paced when you are around to notice it stop, fixed interval when you are
not. Self-paced also resumes the same session every tick, so context accumulates
across every task and a long unattended run hits compaction mid-implementation —
the shell loop is the one that gets a genuinely cold context each time.

Ten minutes is arbitrary — long enough that a tick is rarely wasted, short
enough that a plan you just finished writing doesn't sit for an hour. Tune it to
how fast you plan, not to how fast tasks run.

This is why `task-worker.md` insists on **one task at a time** and on doing
nothing when a task is already running: on a timer, the loop will fire while the
previous task is still open, and two workers in the same repo produce a merge
conflict against themselves. The same reason it commits per task — a loop you
walk away from should leave a readable history, not one giant diff.

The other half of that is knowing when a task is *not* still running. A worker
claims a task by writing `claimed_by` and `claimed_at` into its frontmatter and
committing that before it touches any code. Nothing heartbeats those files, so a
claim older than @@STALE@@ minutes is treated as a dead session — rate limit, crash,
closed laptop — and the next tick reclaims the task instead of skipping it
forever. Without that rule the loop's own failure mode is silence: one task dies
mid-run and every tick after it politely does nothing until morning. The worker
also checks `git status` before starting, because a session that died mid-task
left its work in the tree and the next task must not be built on top of it.

What this changes about your day: your job becomes moving files between the two
folders. A task lands in `tasks/` only after you have read it, so the review step
is where you spend your attention, and the implementation happens whether you
are watching or not. To take something back off the loop, move it to
`not-ready/` and set its status — the worker never looks there.

Which makes the morning routine `ls not-ready/`. Anything the worker gave up on
overnight is in there with the reason in its filename, next to the drafts you
had not finished. Clear that list and the loop has work again. `status.md` is
the longer version of the same look, and it also tells you whether the loop is
still running or died at 3am.

## Tip: give the planner room to run

Planning is not a read-only activity. To write the "What is true today" section
honestly, the agent has to actually check: hit an API to see the real response
shape, query the schema, open the app or a browser to see what the screen does
now, run a test to find out whether the thing you think is broken is broken. A
planner on a tight permission leash asks you to approve each of those, one at a
time, and you end up babysitting the very step you were trying to delegate.
Worse, a planner that gets told "no" a few times stops checking and starts
guessing — and a plan built on guesses is the thing this whole workflow exists
to avoid.

So run planning in auto-accept mode, or with an allowlist as wide as you are
comfortable with, and review once at the end. Where "comfortable" lands is
yours to decide, but the sane version: work on a branch with a clean tree, keep
the loose permissions pointed at this repo and a dev/test environment, and don't
extend them to production credentials, deploys, or anything that sends mail or
posts publicly. The planner's output is a markdown file — if the session goes
somewhere odd, `git diff` shows you everything it touched.

## Tip: plan with the strongest model you have

Use the best model available for `plan.md` — Opus, or whatever the current top
tier is — even if you implement with something cheaper. The task file is the
artifact everything downstream depends on: it has to catch the assumption in
your request that doesn't hold, name the right files and line numbers, and pick
the tradeoff that survives contact with the code. That is the hardest thinking
in the whole loop, and it happens exactly once per task.

The bar for a finished task file is: **an agent can implement it without doing
its own research.** No "figure out where the sort happens" left as an exercise —
the plan already says which function, which line, and why that one. If the
implementer has to go re-derive the context, the plan was a wish, and you have
just moved the hard part to a fresh session with less information than the
planner had.

That is also what makes the worker loop and per-task subagents work at all: a
self-contained task file means a cold context is enough, so tasks stay
independent and one bad session doesn't poison the next.

## Why keep it in the repo

- **Self-contained.** Clone the repo, get the backlog. Nothing to sign up for.
- **Reviewable.** Plans arrive in pull requests next to the code.
- **Grep-able by agents and humans alike.** No API, no MCP server, no sync.
- **Offline and free.** It is markdown.

The tradeoff is real: no cross-repo view, no assignees, no notifications, no
non-technical access. If several people need to see the same board, this is the
wrong tool. For one developer plus agents, the ceremony of a real tracker buys
nothing that a folder doesn't.

## Related work

The folder-of-markdown-tasks pattern is well-trodden — see
[Backlog.md](https://github.com/MrLesk/Backlog.md),
[kanban-md](https://github.com/antopolskiy/kanban-md),
[tasks.md](https://github.com/tasksmd/tasks.md),
[claude-task-master](https://github.com/eyaltoledano/claude-task-master), and the
[Ralph loop](https://github.com/snwfdhmp/awesome-ralph). What is deliberate here
is the discipline around it: plan before implement, plans that push back on the
request, and finished tasks kept with their outcome rather than dropped.
