Turn the current request into an implementation plan and write it to
agents-queue/tasks/ as a markdown file. Write the plan. Do not implement it.

# The bar

**An agent can implement this file without doing its own research.** No "figure
out where the sort happens" left as an exercise — name the function, the line,
and why that one. If the implementer has to re-derive the context, the plan was
a wish, and the hard part just moved to a fresh session with less information
than you had.

# Research first

Planning is not read-only. Before writing anything, go and check: read the
actual code, query the schema, hit the API to see the real response shape, run
the test, open the app and look at the screen. Do the work needed to write "What
is true today" honestly.

If the request rests on an assumption that does not hold — the list is not
sorted the way they think, the field does not exist, the bug is somewhere else —
say so in the plan, in bold, and plan for what is actually there. A plan that
quietly implements a false premise is worse than no plan. If the premise being
wrong changes what should be built at all, set `status: waiting_decision` and
ask in the file rather than guessing.

# Naming

`NN-kebab-case-name.md`, where `NN` is the next unused two-digit number across
**both** `tasks/` and `done/`. Check both folders. Numbers are identifiers as
well as priority — `depends_on` refers to tasks by name, so a duplicate number
makes those references ambiguous and breaks "lowest-numbered first".

# Frontmatter

```yaml
---
title: Group the Review Queue by Scan Session
status: ready_for_implementation
created: 2026-08-01
area: api (go + frontend)
risk: low | medium | high
touches_config_schema: false
touches_db_schema: true
depends_on: 04-session-store, 06-rate-limiter
---
```

`status` is one of:

- `planning` — being written
- `waiting_decision` — needs a human answer before it can proceed
- `blocked` — waiting on another task or something external
- `ready_for_implementation` — reviewed, the worker may pick it up
- `in_progress` — a worker has it
- `done` — implemented, with its Outcome written

`depends_on` is optional and comma-separated. List a task there only when this
one genuinely cannot be built first — the worker will not pick this task until
every dependency sits in `done/`, so a decorative dependency parks the task.

`risk` and the `touches_*` flags decide how carefully the human reads the plan.
A schema change and a CSS tweak are not the same review.

Set `status: ready_for_implementation` yourself only if the plan is complete and
unambiguous. Anything unresolved gets `waiting_decision` with the question
written in the body.

# Body

- **Goal** — what changes and why, in the user's terms.
- **What is true today** — findings from reading the actual code, *especially
  the ones that contradict the request*. Cite files and line numbers.
- **Decided** — the tradeoffs taken and what they cost. Record the options you
  rejected and why, or the next reader re-litigates them.
- **Steps** — per file, per function, with line references.
- **Verify** — the commands to run, then what to look at in the running app.
- **When done** — anything that has to happen beyond the commit itself. If
  `task-worker.md` has a Promotion section configured, name the entry this earns
  there; if it does not, this section is usually one line or absent.

Write it so it survives being wrong: when the implementation goes sideways, the
reasoning is on the page and the reader can see which assumption broke.
