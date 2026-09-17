---
name: autumn-usage
description: Read-only queries against Autumn billing (api.useautumn.com) — customer list, one customer's subscriptions and feature balances, and active-customers-per-plan. Use when asked who pays for what, which plan a customer is on, whether a customer has run out of a metered feature, or for a count of paying customers by plan.
---

# Autumn usage

Read side only, against Autumn's billing API (`https://api.useautumn.com`).

A runnable client ships with this skill in `scripts/` (bun):

```
scripts/autumn.ts   customers | customer | plans | raw
```

> **`AUTUMN_SECRET_KEY` can create and cancel subscriptions and change feature
> balances — real billing, real money.** This script never calls a mutating
> endpoint. `raw` refuses any path that isn't one of Autumn's own `.get` /
> `.list` read actions, allowlist-style, so a typo or a bad guess at a path
> can't accidentally attach a plan or issue a refund. If a job needs a write,
> it does not belong in this script — say so and stop.

## What it can do

```
autumn customers [--plan <id>] [--since YYYY-MM-DD] [--limit N]   table, newest first
autumn customer <id>                                              subscriptions + feature balances
autumn plans                                                      active customers per plan
autumn raw <path> '<json body>'                                   .get/.list actions only
```

Flags: `--json` on every verb for the raw response.

### `customers`: who's here

Table of `id`, `email`, `created`, active plan(s), newest first. Paginates
Autumn's cursor (`next_cursor`) up to `--limit` (default 200). Filter with
`--plan <id>` or `--since YYYY-MM-DD`.

### `customer <id>`: one account in detail

Subscriptions (plan, status, started, trial-ends, canceled) and feature
balances (feature, granted, usage, remaining) for one customer. This is the
"has this customer used up their quota" call.

### `plans`: who pays for what

Counts active customers per plan, built from the customer list (there is no
dedicated "count by plan" endpoint) — one call answers "who pays for what"
without hand-tallying `customers --json` output.

### `raw`: anything else, carefully

`autumn raw <path> '<json body>'` POSTs to any Autumn path — but only if the
path's last `.`-segment is `get` or `list` (Autumn's own `<resource>.<action>`
naming, e.g. `plans.list`, `products.get`). Anything else — `.create`,
`.update`, `.cancel`, `.attach`, `.checkout`, `.track`, `.expire`, and so on —
is refused before the request is even sent, with an explanation on stderr.
This is an allowlist, not a denylist: an unrecognized action is refused by
default rather than assumed safe.

## Auth

| | |
|---|---|
| Base URL | `https://api.useautumn.com` |
| Header | `Authorization: Bearer $AUTUMN_SECRET_KEY` |
| Header | `x-api-version: 2.3.0` |
| Env var | `AUTUMN_SECRET_KEY` |

**Per-project key.** Different projects bill through different Autumn
instances, so the key has to come from wherever the script is run, not a
shared account-wide file. Lookup order: `./.env.local`, then `./.env`, then
`./.envrc` in the current directory, then `process.env`. Which source was
used is printed to stderr (`autumn: keys from ./.env.local`, etc.), so
stdout stays pipeable for `--json` while the analyst can still report which
instance it queried. **Never printed.**

## Which call for which job

```
"who pays for what?"                        → plans
"is <customer> on the pro plan?"             → customer <id>
"who signed up for <plan> since <date>?"     → customers --plan <plan> --since <date>
"has <customer> hit their usage limit?"      → customer <id>   (check "remaining" per feature)
```

## Gotchas

- **Field casing is inconsistent across Autumn's own docs.** The abstract
  schema pages use snake_case (`created_at`, `plan_id`); the actual example
  payloads use camelCase (`createdAt`, `planId`). The script reads both via a
  `pick()` helper and takes whichever is present — if a new field shows up
  empty, check whether the API returned the other casing.
- **`raw`'s guard is intentionally an allowlist.** A path that should
  obviously be safe but doesn't end in `.get`/`.list` is still refused — fix
  that by adding a new verb here, not by loosening `raw`'s guard.
- **`plans` re-fetches the whole customer list**, so its `--limit` matters
  the same way `customers`' does — raise it if the count looks short of the
  real customer base.
