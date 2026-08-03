---
name: agents-queue
description: A task queue for coding agents that lives in the repo as `agents-queue/` — plan.md and task-worker.md prompts, plus tasks/ and done/ folders of markdown task files. Use to scaffold `agents-queue/` into a repo, to turn the current conversation into a reviewed task file, to pick up and implement the next ready task, or to run the worker on a loop so queued plans get built while nobody is watching.
---

# Agents queue

A folder of markdown task files, versioned with the code they describe. No
Linear, no Jira, no board in another tab.

**Human planning, agent implementing.** The user decides what gets built and what
the plan for it is; the agent turns approved plans into commits. The queue exists
to put a written, reviewed plan in the gap between deciding and building — an
agent that brainstorms and edits files in the same breath implements the first
reading of the request.

```
agents-queue/
├── plan.md          # prompt: turn the current conversation into a task file
├── task-worker.md   # prompt: pick the next ready task and implement it
├── tasks/           # live: ready to be picked up, or waiting on something
└── done/            # finished, with the outcome written at the bottom
```

## Do it

```bash
scripts/init.sh --repo ~/code/github/thing
```

`--stale-minutes 120` if tasks there routinely run longer than 90 minutes.
`--force` to overwrite. It refuses to clobber without it, and prints every file
it wrote.

Creates `tasks/` and `done/` with a `.gitkeep` in each — git does not track empty
directories, and a fresh clone whose `tasks/` vanished gives the worker nothing
to read.

**Then offer promotion, and ask before setting it up.** The queue is complete
without it: a finished task keeps its Outcome in `done/` and that is the record.
But the durable part of a task is often worth a place a person reads without
digging through the queue — a decision as an ADR, a requirement as a PRD, a
click-through flow as a UAT script. Init prints that as a tip; follow it with the
actual question rather than acting on it.

If they say yes, ask where those live in *this* repo before writing anything, and
put the answer in the Promotion section at the bottom of `task-worker.md`. Do not
create the directories or infer the layout from a `docs/` folder happening to
exist — a promotion target invented on the agent's side is a folder nobody asked
for, and the worker will then dutifully fill it. If they say no or don't answer,
leave the section as it ships; step 6.4 does nothing and the queue works.

## Entry points

| Call | Does |
|---|---|
| `/agents-queue` | Claim the next ready task and implement it |
| `/agents-queue init` | Scaffold `agents-queue/` into this repo |
| `/agents-queue plan` | Turn the current conversation into a task file |
| `/agents-queue status` | What is ready, blocked, claimed, and stale |

Bare invocation is the work path because that is the one that runs on a loop.

**The protocol lives in the repo, not here.** `agents-queue/task-worker.md` and
`plan.md` are self-contained on purpose: they name that repo's docs layout and
its stale threshold, and they have to work when piped into an agent that cannot
see this skill. Read the repo's copy and follow it. This file scaffolds and
explains; it does not restate the protocol, and where the two ever disagree the
repo wins.

## Running it on a loop

The queue pays off when the user stops being the one who starts each task. Both
forms below drive this skill from the `loop` skill; nothing else is needed.

**1. `/loop /agents-queue`** — self-paced. The delay after each tick is chosen
from queue state: seconds when a task just finished and more are ready, ~30
minutes when the queue is empty, stop when everything left is blocked. Better
pacing than any fixed number, because a fixed tick both burns no-ops on an empty
queue and makes a task that finished one minute in wait out the rest of the
interval.

**2. `/loop 10m /agents-queue`** — fixed interval. Worse pacing, one property
that beats it: the schedule is external, so it fires whether or not the last tick
succeeded.

That difference decides which to use, and it is correctness, not preference:

- **Someone is around** → form 1. If it dies, they see it.
- **Unattended, overnight, expecting to hit a rate limit** → form 2. A self-paced
  loop continues only if the turn survives to schedule the next wakeup. Rate limit
  lands mid-task and the loop is over — silently, with every remaining ready task
  untouched until morning. A fixed interval keeps firing and picks the work back
  up once the limit resets.

Form 1 also resumes the same session every tick, so context accumulates across
every task all night and long runs hit compaction mid-implementation.

For a non-Claude agent, or to get a genuinely cold context per tick:

```sh
while true; do
  codex exec "$(cat agents-queue/task-worker.md)"
  sleep 600
done
```

This is why `task-worker.md` insists on one task at a time and commits per task:
on a timer the loop fires while the previous task is still open, two workers in
one repo produce a merge conflict against themselves, and a loop nobody is
watching should leave a readable history rather than one giant diff.

## Rules that each cost a debugging session

Keep these when adapting the templates.

- **A claim is written and committed before any code.** `claimed_by` and
  `claimed_at` in the task's frontmatter, committed on their own. An uncommitted
  claim is invisible to the next tick, which is how two workers end up in the same
  repo.
- **A claim older than the stale threshold is a dead session, not a busy one.**
  Nothing heartbeats these files. Without a reclaim rule the loop's own failure
  mode is silence: one task dies mid-run and every tick after it politely does
  nothing until morning.
- **`git status` before starting.** A session that died mid-task left its work in
  the tree. The next task must not be built on top of it, and the worker must
  never `reset --hard` over work it did not write.
- **The folder is the state, not the frontmatter.** `tasks/` is live, `done/` is
  finished; `status` only narrows down which live tasks are pickable. Two sources
  of truth drift, and the folder is the one that always wins.
- **`depends_on` is enforced against `done/`, not against `status`.** A dependency
  still sitting in `tasks/` is not satisfied whatever its status says.
- **A finished task is never deleted.** The plan and its Outcome side by side are
  the record of what was intended versus what was built, and `done/` is where
  anyone looks to find what a piece of work produced.
- **Everything downstream is written from the Outcome, not the plan.** The plan is
  what was intended. Only the Outcome says what happened.
- **Unfinishable work gets `blocked` or `waiting_decision` with a written reason,
  never a silent `in_progress`.** One is recoverable in the morning; the other
  stalls every tick after it.

## What makes a task file worth having

The bar: **an agent can implement it without doing its own research.** No "figure
out where the sort happens" left as an exercise — name the function, the line, and
why that one. If the implementer has to re-derive the context, the plan was a wish
and the hard part just moved to a fresh session with less information than the
planner had.

That bar is also what makes the loop work at all. A self-contained task means a
cold context is enough, so tasks stay independent and one bad session does not
poison the next.

Two things follow, and they are worth saying to the user directly:

- **Plan with the strongest model available**, even when implementing with
  something cheaper. The task file is the artifact everything downstream depends
  on, and it is written exactly once per task.
- **Planning is not read-only.** Writing "What is true today" honestly means
  hitting the API to see the real response shape, querying the schema, opening the
  app, running the test. A planner on a tight permission leash asks to approve each
  of those and the user ends up babysitting the step they were delegating — and a
  planner told "no" a few times stops checking and starts guessing.
