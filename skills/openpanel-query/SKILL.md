---
name: openpanel-query
description: Read-only queries against OpenPanel cloud analytics — headline metrics (visitors, sessions, bounce, duration), top pages, top referrers/UTM sources, and event counts broken down by a property such as blog_slug or utm_campaign. Use when asked which blog posts bring traffic or signups, where visitors come from, how a launch's traffic looked, or any "how many X happened" question backed by tracked events. Not for installing or wiring up tracking — that is the sibling skill `openpanel-opennext-cloudflare`.
---

# OpenPanel query

Read side only, against OpenPanel **cloud** (`https://api.openpanel.dev`).
Getting the tracker installed in a Next/OpenNext/Cloudflare app — the
browser client, the server SDK, the proxy worker that dodges ad blockers — is
the sibling skill `openpanel-opennext-cloudflare`. That skill's env vars
(`OPENPANEL_CLIENT_ID` / `OPENPANEL_CLIENT_SECRET`) are a **write** client and
cannot be reused here; see the gotcha below.

A runnable client ships with this skill in `scripts/` (bun):

```
scripts/openpanel.ts   metrics | pages | referrers | events | raw
```

> **The default project client cannot read.** OpenPanel creates one API
> client per project automatically, in `write` mode — good for the tracking
> beacon, a 401 for everything here. The Export and Insights APIs need a
> client created in `read` or `root` mode. Make one in the OpenPanel
> dashboard (Settings → API keys / clients) before this script will work.

## What it can do

```
openpanel metrics                                             headline numbers for the range
openpanel pages                                                top pages by views/sessions
openpanel referrers                                             top referrers / UTM sources
openpanel events blog_view signup --breakdown blog_slug         event counts, split by a property
openpanel raw <path> '<json query params>'                     anything else, GET only
```

Flags on any verb: `--json` for the raw response, `--range <7d|30d|3m|6m|12m|today|
yesterday|monthToDate|lastMonth|...>` (default `30d`), or `--start YYYY-MM-DD
--end YYYY-MM-DD` for a custom range (overrides `--range`).

**Every human-readable output prints the date range it queried.** A number
without a range attached is not something an analyst can report — always
relay the range alongside the figure.

### `metrics`: the headline numbers

Visitors, sessions, bounce, duration — whatever the Insights API actually
returns for `GET /insights/{projectId}/metrics`. The exact field set is
loosely documented, so the script prints every key in the response rather
than mapping to named fields that might not exist. If a number looks off,
run with `--json` and compare.

### `pages`: what people are reading

Top pages by session/view count, from `GET /insights/{projectId}/pages`.

### `referrers`: where people came from

Top values of the referrer dimension, from `GET /insights/{projectId}/referrer`
(the endpoint name is singular — easy to get wrong from memory).

### `events`: how often did X happen

```
openpanel events blog_view --breakdown blog_slug --range 30d
openpanel events signup --breakdown utm_campaign
```

Counts one or more named events over the range via `GET /export/charts`,
optionally split by a property (`blog_slug`, `utm_campaign`, anything tracked
on the event). This is the call for "which blog posts bring signups": run
`events blog_view --breakdown blog_slug` and `events signup --breakdown
blog_slug` (or a referrer/UTM property linking the two) and compare.

**Unverified:** the exact query-string encoding `/export/charts` expects for
its `series` / `breakdowns` array-of-object parameters isn't nailed down in
the public docs — no worked example exists there. The script JSON-encodes
each into a single query value (e.g. `series=[{"name":"blog_view"}]`), the
common shape for a typed query schema. If OpenPanel rejects that shape, the
command prints the raw error body; explore with `raw /export/charts` instead,
then fix this note and `events()` in the script together once the real shape
is known.

## Auth

| | |
|---|---|
| Base URL | `https://api.openpanel.dev` |
| Headers | `openpanel-client-id`, `openpanel-client-secret` |
| Env vars | `OPENPANEL_READ_CLIENT_ID`, `OPENPANEL_READ_CLIENT_SECRET`, `OPENPANEL_PROJECT_ID` |
| Client mode | must be `read` or `root` — the default `write` client 401s |

Names are deliberately distinct from `OPENPANEL_CLIENT_ID` / `_SECRET`, the
write-client vars the app itself uses to send events, so the two are never
mixed up in one `.env`.

**Per-project key.** Different projects point at different OpenPanel
instances, so the key has to come from wherever the script is run, not a
shared account-wide file. Lookup order: `./.env.local`, then `./.env`, then
`./.envrc` in the current directory, then `process.env`. The first source
that has `OPENPANEL_READ_CLIENT_ID` wins, and **all three vars must come from
that one source** — mixing a client id from one file with a project id from
another would silently query the wrong instance. If the chosen source is
missing one of the other two vars, the script errors out naming the file and
what's missing rather than falling back elsewhere. Which source was used is
printed to stderr (`openpanel: keys from ./.env.local`, etc.), so stdout
stays pipeable for `--json` while the analyst can still report which
instance it queried. **Never printed.**

## Which call for which job

```
"which blog posts bring signups?"      → events blog_view --breakdown blog_slug
                                          events signup --breakdown blog_slug   (compare)
"where do visitors come from?"         → referrers
"what are people reading?"             → pages
"how did last week look overall?"      → metrics --range 7d
"did the launch post spike traffic?"   → events blog_view --breakdown blog_slug --range 30d
```

## Gotchas

- **401 on every call** almost always means the client is in `write` mode.
  Create a `read` or `root` client in the dashboard; don't reuse the app's
  tracking client.
- **`referrer`, not `referrers`.** The Insights endpoint name is singular.
- **Field names in `metrics`/`pages`/`referrers` are not fully documented.**
  The script reads generically (first matching candidate key, or the whole
  response) rather than assuming a schema. If a table prints "(no rows
  returned...)" or looks sparse, re-run with `--json` and look at what
  actually came back before concluding the data isn't there.
- **`events`' query encoding is a best-effort guess**, not a confirmed
  contract — see the note above. Treat its output as provisional until
  someone runs it against a live read-mode client and it looks right.
