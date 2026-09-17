---
name: seo-dataforseo
description: SEO data via DataForSEO's pay-as-you-go API: organic traffic estimates for a list of domains, keyword search volume / difficulty / CPC, backlink and SERP data. Use when asked to size a competitor's organic traffic, check whether a keyword is worth targeting, compare a set of domains, or get any Ahrefs/Semrush-shaped number without a subscription. Also the place to check the account balance before spending it.
---

# DataForSEO

The working substitute for the Ahrefs API, which is dead on the user's Starter
plan (0 API units, see `~/manager/tools/ahrefs.md`). Pay-as-you-go, no
subscription, and roughly two orders of magnitude cheaper per question.

Read side only: it measures what already ranks. To _push_ URLs at a search
engine so they get crawled in the first place, that is the sibling skill
`seo-indexnow`.

> **The balance is $0.41 and the minimum top-up is $50.** Treat every billed
> call as coming out of a fixed pot. Three rules, in order:
>
> 1. **Check `balance` first. It is free.**
> 2. **Batch.** Cost is a flat per-task charge plus a rounding error per item.
>    Twenty keywords in one call costs the same as one. A loop of twenty
>    single-keyword calls costs twenty times as much and answers the same thing.
> 3. **Never loop the script over a list.** Pass the whole list as arguments.

A runnable client ships with this skill in `scripts/` (bun):

```
scripts/dataforseo.ts   balance | traffic | keywords | raw
```

It reads `DATAFORSEO_API_KEY` from the environment, falling back to `.envrc`.
Improve the script here. This skill is its home.

## What it can do

```
dataforseo balance                                     free
dataforseo traffic stripe.com plaid.com mercury.com    one call, N domains
dataforseo keywords "budgeting app" "net worth tracker"  one call, N keywords
dataforseo raw <endpoint-path> '<json body>'           anything in the appendix
```

Flags on any verb: `--json` for the raw response, `--location <code>`
(default `2840`, US), `--language <code>` (default `en`).

Every billed call prints `cost $X · balance $Y` to **stderr** when it finishes,
so `--json` stdout stays pipeable and you always know what you just spent.

### `traffic`: how big is this domain, organically

Sorted table, biggest first: estimated monthly organic visits (`etv`) and the
number of keywords the domain ranks for. This is the "size up a competitor"
call, and it takes up to 1,000 domains in a single request, so size up the
whole competitive set at once, not one company at a time.

### `keywords`: is this term worth targeting

Sorted by volume descending: monthly search volume, keyword difficulty (0-100),
CPC in USD, and competition level. This is the "should we write this page" call.

## Capability matrix

Legend: **✓** wired in `scripts/dataforseo.ts` · **○** documented, not wired,
reachable today via `dataforseo raw <path> '<body>'`, or promote it into a real
verb · **na** no such endpoint.

Costs are **measured only**. `unmeasured` means exactly that: nobody has run it
and been billed, so do not quote a number from the published rate card, because it
overstates reality by roughly 10x.

| Job                                            | Endpoint                                                         |             | Cost                                       |
| ---------------------------------------------- | ---------------------------------------------------------------- | ----------- | ------------------------------------------ |
| **Balance / spend**                            | `appendix/user_data`                                             | ✓           | **free**                                   |
| **Organic traffic, many domains**              | `dataforseo_labs/google/bulk_traffic_estimation/live`            | ✓           | **$0.0122** / 2 domains · **$0.0136** / 13 |
| **Keyword volume + KD + CPC**                  | `dataforseo_labs/google/keyword_overview/live`                   | ✓           | **$0.0143** / 20 keywords                  |
| Anything below, ad hoc                         | any path                                                         | ✓ via `raw` | whatever that endpoint costs               |
| Difficulty only, in bulk                       | `dataforseo_labs/google/bulk_keyword_difficulty/live`            | ○           | unmeasured                                 |
| What keywords does a domain rank for           | `dataforseo_labs/google/ranked_keywords/live`                    | ○           | unmeasured                                 |
| Who else ranks where this domain ranks         | `dataforseo_labs/google/competitors_domain/live`                 | ○           | unmeasured                                 |
| Who owns this SERP, for a keyword set          | `dataforseo_labs/google/serp_competitors/live`                   | ○           | unmeasured                                 |
| Longer-tail variants of a seed                 | `dataforseo_labs/google/keyword_suggestions/live`                | ○           | unmeasured                                 |
| Related searches ("searches related to")       | `dataforseo_labs/google/related_keywords/live`                   | ○           | unmeasured                                 |
| Keywords a site already targets                | `dataforseo_labs/google/keywords_for_site/live`                  | ○           | unmeasured                                 |
| Volume back to 2019                            | `dataforseo_labs/google/historical_search_volume/live`           | ○           | unmeasured                                 |
| Traffic trend, not a snapshot                  | `dataforseo_labs/google/historical_bulk_traffic_estimation/live` | ○           | unmeasured                                 |
| Domain's whole rank/traffic summary            | `dataforseo_labs/google/domain_rank_overview/live`               | ○           | unmeasured                                 |
| Which pages of a site pull the traffic         | `dataforseo_labs/google/relevant_pages/live`                     | ○           | unmeasured                                 |
| Keywords two domains both rank for             | `dataforseo_labs/google/domain_intersection/live`                | ○           | unmeasured                                 |
| Informational vs commercial vs transactional   | `dataforseo_labs/google/search_intent/live`                      | ○           | unmeasured                                 |
| Backlink profile summary                       | `backlinks/summary/live`                                         | ○           | unmeasured                                 |
| Backlink summary for up to 1000 targets        | `backlinks/bulk_ranks/live`                                      | ○           | unmeasured                                 |
| Who links to a competitor                      | `backlinks/referring_domains/live`                               | ○           | unmeasured                                 |
| Live Google SERP for a query                   | `serp/google/organic/live/advanced`                              | ○           | unmeasured                                 |
| Google Ads volume (source of truth for volume) | `keywords_data/google_ads/search_volume/live`                    | ○           | unmeasured                                 |
| Search interest over time                      | `keywords_data/google_trends/explore/live`                       | ○           | unmeasured                                 |

Full appendix of paths at the bottom.

## Which call for which job

```
"how much traffic does <company> get?"           → traffic <domain...>       ✓
"how do these N competitors compare?"            → traffic a.com b.com c.com ✓  (ONE call)
"is <term> worth ranking for?"                   → keywords "<term>" ...     ✓
"what should we write about?"                    → keyword_suggestions       ○
"what is <competitor> already ranking for?"      → ranked_keywords           ○
"who are our SEO competitors?"                   → competitors_domain        ○
"who links to them?"                             → backlinks/summary         ○
"what does Google actually show for X?"          → serp/google/organic/live  ○
"how much have we got left?"                     → balance                   ✓ free
```

The two ✓ calls answer most real questions. Reach for an ○ endpoint only when
the ✓ ones genuinely cannot, because its cost is unknown and the balance is not.

## Auth

|          |                                                           |
| -------- | --------------------------------------------------------- |
| Base URL | `https://api.dataforseo.com`                              |
| Env var  | `DATAFORSEO_API_KEY`                                      |
| Header   | `Authorization: Basic $DATAFORSEO_API_KEY`                |
| Encoding | **The key is already base64.** Do not re-encode it.       |
| Account  | `wildan@klu.so`, key lives in `~/manager/.envrc` (direnv) |

Read it from the environment. **Never print it, never write it to a file, never
put it in a URL.**

Free balance check, if you are not using the script:

```
curl -s https://api.dataforseo.com/v3/appendix/user_data \
  -H "Authorization: Basic $DATAFORSEO_API_KEY"
```

Balance is at `.tasks[0].result[0].money.balance`.

## Request shape

All the endpoints worth using end in `/live`: one POST in, results out, **no
polling and no task_get round trip.** The body is always an _array_ of task
objects. A bare object is a 400.

```jsonc
// bulk_traffic_estimation
[{ "targets": ["stripe.com", "plaid.com"], "location_code": 2840,
   "language_code": "en", "item_types": ["organic"] }]

// keyword_overview
[{ "keywords": ["budgeting app"], "location_code": 2840, "language_code": "en" }]
```

Results are at `tasks[0].result[0].items[]`. The fields that matter:

| Want                        | Path on the item                        |
| --------------------------- | --------------------------------------- |
| Domain                      | `target`                                |
| Est. monthly organic visits | `metrics.organic.etv`                   |
| Ranking keyword count       | `metrics.organic.count`                 |
| Keyword                     | `keyword`                               |
| Search volume               | `keyword_info.search_volume`            |
| CPC                         | `keyword_info.cpc`                      |
| Competition                 | `keyword_info.competition_level`        |
| Difficulty (0-100)          | `keyword_properties.keyword_difficulty` |

`location_code` is `2000 + the ISO 3166 numeric country code`: **2840** US,
**2826** UK, **2276** Germany, **2246** Finland. Location and language change
the answer, so an unqualified "search volume" figure means US/English unless
someone said otherwise.

## Gotchas

- **HTTP 200 is not success.** DataForSEO returns 200 with a `status_code` in
  the body; only `20000` means OK. Task-level failures hide one level deeper in
  `tasks[0].status_code`. The client checks both, and anything hand-rolled must too.
- **A near-zero etv on a domain you know is big is an index artifact.**
  `monarchmoney.com` returns `etv=22` and 5 ranking keywords despite being a
  large funded company with DR 70. Reproduced again on 2026-09-02. Cross-check
  against Ahrefs' free DR endpoint or plain common sense before writing "they
  have no traffic" into a report, because you will be wrong.
- **etv is an estimate of organic search visits only.** No direct, no paid, no
  app, no social. An app-store-first product can have real revenue and etv near
  zero, and that is not a contradiction.
- **The published rate card is not the price.** It overstates real cost by
  roughly 10x. Measure, then record the measurement here.
- **Per-task, not per-item.** 2 domains cost $0.0122; 13 cost $0.0136. The
  marginal item is almost free and the call is not. This is the whole economics
  of the tool: one fat call, never many thin ones.
- **`keyword_overview` may return fewer items than you asked for**, because keywords
  with no data are silently dropped, and returned keywords are normalised
  (lowercased). The client names what came back empty.
- **Costs recorded here are measured, not quoted.** If you run an ○ endpoint,
  note what it actually cost and move it up the table. That is the single most
  useful edit anyone can make to this file.

## Topping up

$50 minimum deposit at `https://app.dataforseo.com/`. The user considers that
high and has not done it. So when a request would obviously blow through $0.41,
ranked_keywords across a dozen competitors, a backlink crawl, **say what it
will cost before running it**, not after.

## Endpoint appendix: the implement-later spec

Base `https://api.dataforseo.com`, `Authorization: Basic` header, POST with an
array body. `✓` = wired in `scripts/dataforseo.ts`. Everything else is one
`dataforseo raw <path> '<body>'` away, or a small addition to the script.

**DataForSEO Labs, keywords** (all `/v3/dataforseo_labs/google/<x>/live`)
`keyword_overview` ✓ · `bulk_keyword_difficulty` · `keyword_suggestions` ·
`keyword_ideas` · `related_keywords` · `keywords_for_site` ·
`historical_search_volume` · `historical_keyword_data` · `search_intent` ·
`top_searches` · `keywords_for_categories`

**DataForSEO Labs, domains and competitors** (same prefix)
`bulk_traffic_estimation` ✓ · `historical_bulk_traffic_estimation` ·
`ranked_keywords` · `competitors_domain` · `serp_competitors` ·
`domain_rank_overview` · `historical_rank_overview` · `domain_intersection` ·
`page_intersection` · `relevant_pages` · `subdomains` ·
`categories_for_domain` · `domain_metrics_by_categories` · `historical_serps`

**Backlinks** (all `/v3/backlinks/<x>/live`)
`summary` · `history` · `backlinks` · `anchors` · `referring_domains` ·
`referring_networks` · `domain_pages` · `domain_pages_summary` ·
`competitors` · `domain_intersection` · `page_intersection` ·
`timeseries_summary` · `timeseries_new_lost_summary` · `bulk_ranks` ·
`bulk_backlinks` · `bulk_referring_domains` · `bulk_spam_score` ·
`bulk_new_lost_backlinks` · `bulk_new_lost_referring_domains`

**Keywords Data**
`/v3/keywords_data/google_ads/search_volume/live` ·
`/v3/keywords_data/google_ads/keywords_for_site/live` ·
`/v3/keywords_data/google_ads/keywords_for_keywords/live` ·
`/v3/keywords_data/google_ads/ad_traffic_by_keywords/live` ·
`/v3/keywords_data/google_trends/explore/live` ·
`/v3/keywords_data/dataforseo_trends/explore/live` ·
`/v3/keywords_data/dataforseo_trends/subregion_interests/live` ·
`/v3/keywords_data/dataforseo_trends/demography/live`

**SERP** `/v3/serp/google/organic/live/advanced` (also `/regular`)

**Appendix (free)** `/v3/appendix/user_data` ✓ gives balance and rate limits

Exact params and response schema for any of these:
`https://docs.dataforseo.com/v3/`. The path maps directly, e.g.
`docs.dataforseo.com/v3/dataforseo_labs-google-ranked_keywords-live/`. Check the
request shape there before spending, not after.
