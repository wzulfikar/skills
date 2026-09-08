---
name: seo-indexnow
description: Get pages crawled and indexed by pushing URLs at search engines with the IndexNow protocol — free, no account, no quota, covers Bing (and therefore ChatGPT search), Yandex, Seznam, Naver, Yep. Use when asked to submit a URL or sitemap to Bing, speed up indexing, ping search engines after a deploy, wire an indexing hook into CI, fix "my new pages aren't showing up", or improve how a site is discovered and cited by ChatGPT and Copilot. Also the place for the robots.txt rules that decide whether AI crawlers can see the site at all.
---

# IndexNow

The write side of SEO: tell a search engine a URL changed, instead of waiting
for it to come back on its own. Free, unauthenticated, no account to create.
The sibling read-side skill is `seo-dataforseo`, which measures what already
ranks.

> **Only submit URLs that actually changed.** There is no published rate limit,
> which makes it tempting to fire the whole sitemap on every deploy. Don't.
> Engines quality-score submissions, and a host that re-pings unchanged pages
> gets discounted or ignored — a cost you cannot see and cannot undo quickly.
> `sitemap --since` exists precisely so a deploy hook sends the delta.

**Not Google.** Google does not participate in IndexNow and has said so. This
buys Bing, Yandex, Seznam, Naver and Yep. For Google, the only levers are a
sitemap and the Search Console UI — the Google Indexing API is `JobPosting` and
`BroadcastEvent` only, and using it for ordinary pages is against its terms.

A runnable client ships with this skill in `scripts/` (bun):

```
scripts/indexnow.ts   key | check | submit | sitemap
```

It reads `INDEXNOW_KEY` from the environment, falling back to `.envrc`.
Improve the script here. This skill is its home.

## Setup, once per host

```bash
indexnow key                      # prints a key + exactly where the file goes
# serve it at https://<host>/<key>.txt  — contents are the key, nothing else
export INDEXNOW_KEY=<key>         # into .envrc
indexnow check <host>             # proves the file is live and correct
```

`check` is the whole setup test and it is free. Run it before the first submit
and after any host/CDN change, because a `403` on submit and a missing key file
look identical from the outside.

The key is **not a secret**. It is public by design — anyone can fetch the file.
It proves control of the host, nothing more. Do not put it in a secret manager
and do not rotate it on a schedule.

## What it can do

```
indexnow key                                   free, generates a key
indexnow check example.com                     free, verifies the key file
indexnow submit https://x.com/a https://x.com/b   one call, N URLs
indexnow sitemap https://x.com/sitemap.xml     reads the sitemap, submits it
```

Flags: `--since <YYYY-MM-DD>` (sitemap only, filters on `<lastmod>`), `--dry`
(print the list, send nothing), `--engine <name>`, `--key <k>`,
`--key-location <url>`, `--json`.

`sitemap` follows a `<sitemapindex>` one level down and handles `.gz`. Verified
against `bun.sh/sitemap.xml`: 18,133 URLs across nested sitemaps, auto-chunked
into 2 calls at the 10,000-URL limit.

## Which call for which job

```
"submit this page to Bing"                    → submit <url>
"we just deployed, ping the changed pages"    → sitemap <url> --since <date>
"submit our whole sitemap" (first time only)  → sitemap <url>
"is our IndexNow set up right?"               → check <host>          free
"why aren't new pages indexed?"               → check, then robots.txt below
```

Default endpoint is `api.indexnow.org`, which **fans one call out to every
participating engine**. Submitting to Bing and Yandex separately is redundant;
`--engine` exists for debugging one engine, not for normal use.

## Status codes

`200` means *accepted*. It never means indexed, and nothing in this protocol
will ever tell you a page got indexed — that answer lives in Bing Webmaster
Tools.

| Code | Means | Do |
|---|---|---|
| `200` | Accepted | Nothing |
| `202` | Accepted, key pending validation | Normal on first submit. `check` the file. |
| `400` | Malformed request | Bad JSON or missing field |
| `403` | Key file missing/unreadable/mismatched | `check <host>` |
| `422` | URL not on `host`, or key/host mismatch | One host per call — the client enforces this |
| `429` | Throttled | Stop. You are submitting too much or too often. |

## Gotchas

- **`200` is not indexed.** It is a queue acknowledgement. Bing decides
  separately, and low-quality or thin pages get accepted and then dropped.
- **The key file must contain the key and nothing else.** A SPA that serves
  `index.html` for unknown paths returns HTTP 200 with HTML, which reads as a
  live key file to a naive check and a `403` to the engine. `check` catches
  exactly this and prints what came back instead.
- **One host per call.** `www.x.com` and `x.com` are different hosts. So are
  `http` and `https` in the `urlList`, so submit canonical URLs only.
- **IndexNow is a delta signal, not an inventory.** It says nothing about pages
  you never pinged. Keep `Sitemap:` in `robots.txt` — that is what backfills
  everything predating the integration or missed by a hook. The two mechanisms
  are complementary and neither replaces the other.
- **No feedback loop of its own.** To find out whether submissions land, verify
  the site in Bing Webmaster Tools and read it there. Free, read-only, and the
  only way to see the result.
- **Bing's older URL Submission API (`SubmitUrlBatch`) is redundant with this.**
  It does the same job with OAuth and a 10k/day quota. Bing's own docs point at
  IndexNow now. Skip it unless the quota telemetry is wanted.
- **`--since` needs `<lastmod>`.** Sitemaps without it filter to zero and the
  client says so loudly. Many generators omit it; fix the generator, or pass
  explicit URLs to `submit` from the build instead.

## Why this matters for ChatGPT

ChatGPT search leans on the Bing index, supplemented by its own crawler. So
IndexNow is the only *push* lever on ChatGPT visibility that exists. The rest is
access, and access is decided by `robots.txt`:

```
User-agent: OAI-SearchBot      # search index — the one that matters
Allow: /

User-agent: ChatGPT-User       # live fetch when a user asks
Allow: /

User-agent: GPTBot             # training corpus — separate decision
Allow: /

Sitemap: https://example.com/sitemap.xml
```

Blocking `OAI-SearchBot` makes a site invisible in ChatGPT search no matter how
well it ranks in Bing. The three agents are separate decisions: a site can allow
search indexing and refuse training by allowing the first two and blocking
`GPTBot`.

Two things beat any amount of submitting:

- **Server-render.** `ChatGPT-User` does not execute JavaScript. A client-only
  React app is a blank page to it.
- **Fast TTFB.** Live fetches time out quickly, and a timeout is a lost citation.

## Deploy hook

The whole integration, for a site whose sitemap carries `<lastmod>`:

```bash
# after deploy
indexnow sitemap https://example.com/sitemap.xml --since "$(date -v-1d +%F)"
```

Or, when the build already knows what changed, skip the sitemap round trip:

```bash
indexnow submit $(git diff --name-only HEAD~1 HEAD -- 'content/**' \
  | sed 's|^content/|https://example.com/|; s|\.mdx\?$||')
```

`check` and every failing submit exit non-zero, so CI can gate on them.

## Protocol appendix

| | |
|---|---|
| Endpoint | `https://api.indexnow.org/indexnow` (fans out to all engines) |
| Method | `POST`, `Content-Type: application/json; charset=utf-8` |
| Body | `{ "host", "key", "keyLocation", "urlList" }` |
| Max URLs | 10,000 per call |
| Single URL | `GET /indexnow?url=<url>&key=<key>` |
| Key format | 8–128 chars, `a-z A-Z 0-9 -` |
| Key file | `https://<host>/<key>.txt`, `text/plain`, contents = the key |
| Auth | none |
| Docs | `https://www.indexnow.org/documentation` |

`keyLocation` is only needed when the file is not at the host root — a
subdirectory deploy, or one key shared across hosts. The client defaults it to
`https://<host>/<key>.txt`, which is right almost always.
