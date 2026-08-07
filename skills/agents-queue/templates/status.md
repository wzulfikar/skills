Report the state of the queue. Read only — change nothing.

Read `agents-queue/tasks/`, `agents-queue/not-ready/` and `agents-queue/done/`,
plus `git status`. Print the report below and stop.

This prompt never claims a task, never reclaims a stale one, never moves a file
and never touches the working tree. Its whole job is to be safe to run while a
worker is mid-task, so anything it fixes on the way is a race. If it finds
something wrong, it says so and leaves it.

# The report

```
NEEDS YOU (2)
  03-oauth-scope        waiting_decision  4d   which tenant owns the refresh token?
  07-cdn-purge          blocked           2d   blocked on INFRA-221

IN PROGRESS (1)
  06-rate-limiter       claude-loop       12m

READY (3)
  04-session-store      medium risk, touches db schema
  05-search-rank        low risk
  09-export-csv         low risk  — waits on 04-session-store

DRAFTS (1)
  05-search-rank.draft  planning          1d

DONE  14 tasks, last 08-nav-crumbs (2h ago)
```

Order matters: what is stalled on a human comes first, because that is the only
part of the report anyone can act on. An empty section is dropped entirely
rather than printed empty — except `NEEDS YOU`, which prints `NEEDS YOU (0)` so
the absence is stated rather than left ambiguous.

**NEEDS YOU** — files in `not-ready/` with `status: waiting_decision` or
`blocked`. Age is from `created`, or from the file's last commit if that is
later. The last column is the question or the blocker, taken from the body — not
copied from the filename segment, which is an abbreviation of it.

**IN PROGRESS** — `tasks/` with `status: in_progress`. Show `claimed_by` and the
age of `claimed_at`. Past @@STALE@@ minutes append `— STALE, next worker will
reclaim it`. Do not reclaim it here.

**READY** — `tasks/` with `status: ready_for_implementation`, lowest number
first, which is the order a worker will take them in. Carry `risk` and any
`touches_*` that is true, since those decide how carefully the plan gets read.
If `depends_on` names anything not in `done/`, append `— waits on <names>` and
list it last: it is in `tasks/` but not pickable.

**DRAFTS** — `not-ready/` with `status: planning`. Separate from `NEEDS YOU`
because a half-written plan is not a question waiting on an answer.

**DONE** — one line. Count, plus the most recent by commit time.

# Then, only if any of it is true

Report these under the table, one line each. They are the failure modes the
queue actually hits, and each is a thing a person has to decide about:

- **The tree is dirty.** Name the files. If nothing is `in_progress`, a session
  died mid-task and its work is still sitting there — the next worker will refuse
  to start on top of it.
- **A file's folder and `status` disagree** — `ready_for_implementation` in
  `not-ready/`, or `blocked` in `tasks/`. The folder is the truth; the status is
  wrong, and a `blocked` task in `tasks/` will be picked up and fail again.
- **A two-digit prefix is used twice** across the three folders. `depends_on`
  refers to tasks by name, so a duplicate makes those references ambiguous.
- **A `depends_on` names a task that exists nowhere.** It will never be
  satisfied, so that task is parked forever.
- **A file in `not-ready/` has no reason segment in its filename** — it is
  invisible to the `ls` the folder exists for.
- **Everything left is blocked or waiting.** Say it plainly: a loop has nothing
  to do until a human moves something into `tasks/`, and that is the signal to
  stop looping rather than to keep ticking.

An empty queue is not a problem. Say `queue is empty` and stop.
