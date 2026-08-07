Check the queue for ready tasks and pick the next one to work on.

See agents-queue/tasks/ for tasks.

- Do one task at a time.
- If a task is already running, do nothing.
- Commit per task.

Each task in the queue is self-contained, so always run a subagent to complete
the task.

---

The agents-queue/tasks/ folder contains the tasks I have reviewed and that are
ready to be picked up for implementation. Each .md file has a frontmatter header
with a `status` field, and a two-digit prefix followed by a short description.

**The folder is the state, not the frontmatter**, and it splits by who has to act
next:

| Folder | Whose | Holds |
|---|---|---|
| `tasks/` | the worker's | `ready_for_implementation`, `in_progress` |
| `not-ready/` | the human's | `planning`, `waiting_decision`, `blocked` |
| `done/` | nobody's | `done`, with its Outcome |

Read only `tasks/`. Nothing in `not-ready/` is yours to pick up, whatever its
status says — a person has to move it across before it becomes work. That is the
point of the split: `ls not-ready/` is a list of things stalled on a human, and
it stays readable only if the worker never files anything there and forgets to
say why.

Changing a task's status means moving its file. Never leave the two disagreeing.

When a task is done it moves to agents-queue/done/, with an Outcome section
written at the bottom. That file is the record — nothing else is required.

# Instruction

## 1. Check whether a task is already running

Read the frontmatter of every file in `tasks/`. If any has
`status: in_progress`, look at its `claimed_at`:

- **Less than @@STALE@@ minutes old** → a worker has it. Stop here. Do nothing, do not
  pick another task, do not touch the working tree.
- **Older than @@STALE@@ minutes** → the session that claimed it is dead (rate limit,
  crash, closed laptop). It is yours to reclaim. Continue to step 2.

Nothing heartbeats these files, so @@STALE@@ minutes is a guess at "longer than any
task should take". If a task legitimately runs longer than that, raise the
number here rather than letting workers steal live tasks from each other.

## 2. Clean up after a dead session

Only when reclaiming a stale `in_progress` task, or when `tasks/` has no
`in_progress` task but `git status` is dirty:

Run `git status` and `git diff`. Uncommitted changes are the remains of a
session that died mid-task. Do not start a new task on top of them.

- If the changes are a coherent partial implementation of the stale task,
  keep them and resume that task — it stays the current task, do not pick a
  different one.
- If they are incoherent or you cannot tell what they were for, stop and report
  what you found. Leave the tree alone. Never `git reset --hard` or `git
  checkout` over work you did not write.

## 3. Pick the task

Among the files in `tasks/`, consider only those with
`status: ready_for_implementation`. A reviewed task is in `tasks/` and an
unreviewed one is in `not-ready/`, so this filter should be redundant — check it
anyway. When it is not redundant, a file was moved without its status being
updated, and picking it up means implementing a plan nobody approved.

Then drop any task whose `depends_on` is not satisfied. `depends_on` is a
comma-separated list of task names; a dependency is satisfied only when a file
with that name exists in `done/`. A dependency sitting in `tasks/` or
`not-ready/` is not satisfied, whatever its status says.

Of what remains, take the lowest-numbered one. If nothing remains, say so and
stop — an empty queue is a normal outcome, not a reason to invent work.

## 4. Claim it

Before any code changes, write the claim to the task's frontmatter and commit it
on its own:

```yaml
status: in_progress
claimed_by: <a name for this session, e.g. codex-loop or claude-loop>
claimed_at: <current UTC time, ISO 8601, e.g. 2026-08-04T01:27:00Z>
```

The claim has to land in git before the work starts. An uncommitted claim is
invisible to the next tick, which is how two workers end up in the same repo.

## 5. Do the work

Run the task in a subagent. The task file is self-contained — the subagent gets
the file and needs no other context. Follow its Steps, then its Verify section.

## 6. Finish

When the implementation is verified:

1. Append an **Outcome** section to the bottom of the task file: what was
   actually built, where it diverged from the plan and why, the commit sha, and
   anything the plan got wrong. The plan is what you intended; this is what
   happened. Anything written from this task later — a doc, the next task that
   builds on it — is written from the Outcome, not from the plan.
2. Set `status: done` and remove `claimed_by` / `claimed_at`.
3. Move the file to `agents-queue/done/`.
4. Promote, if and only if the Promotion section below says where to. Do not
   invent a destination for a finished task.
5. Commit.

If the work cannot be finished — a blocker, a decision only the human can make —
do not leave the task at `in_progress`, and do not leave it in `tasks/`:

1. Set `status: blocked` or `status: waiting_decision`, and remove `claimed_by` /
   `claimed_at`.
2. Write the reason into the body — what you tried, where it stopped, and the
   exact question if there is one.
3. Rename the file to `NN-name.<why>.md`, adding one short kebab-case segment
   summarising that reason: `07-cdn-purge.blocked-on-INFRA-221.md`,
   `03-oauth-scope.ask-which-tenant-owns-refresh-token.md`. This is the line the
   human reads off `ls`, so make it specific — `.blocked` tells them nothing.
4. Move it to `agents-queue/not-ready/`, commit, and stop.

A task parked in `not-ready/` with a reason in its name is recoverable in the
morning; one left silently `in_progress` stalls every tick after it, and one
dropped back into `tasks/` gets picked up again and fails the same way.

Leave any partial work as its own commit before moving the task, or say in the
task body that you reverted it. Do not leave the tree dirty for the next tick.

# Promotion

**Not set up.** A finished task and its Outcome live in `done/` and that is the
whole record.

Some repos want the durable part of a task to also land somewhere a person reads
without digging through the queue — a decision as an ADR, a requirement as a PRD,
a click-through flow as a UAT script. That is a good idea and it is not
configured here, because where those live is a property of this repo and guessing
at it produces a folder nobody asked for.

To turn it on, replace this section with the destinations and the rule for each,
in the shape:

```
| Task contains | Goes to |
|---|---|
| A decision and its reasoning | <path> |
```

Until then, step 6.4 does nothing.
