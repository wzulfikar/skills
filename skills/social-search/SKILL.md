---
name: social-search
description: Search and fetch posts, profiles, and comments across social platforms via two providers — socialdata.tools (X/Twitter, cheap and deep) and socialcrawl.dev (48 other platforms, one unified schema). Use when asked to find posts/leads/reply-opportunities on a topic, pull a profile or a thread, monitor mentions, or gather social data — and to decide which provider to call for a given platform.
---

# Social search

Two providers cover everything. The whole skill is knowing **which one to call**.

> **Default to socialcrawl.** One key already searches ~12 platforms — you rarely
> need anything else. **The one exception is X:** socialcrawl can't do a real
> keyword feed search for it, so **X search → socialdata**. If the task doesn't
> touch X, you never leave socialcrawl.

Runnable clients ship with this skill in `scripts/` (bun):

```
scripts/socialdata.ts   profile|followers|search|post   — X, via socialdata.tools
scripts/socialcrawl.ts  profiles|posts|search|post      — Instagram/Threads/…, via socialcrawl.dev
```

Each reads its key from the environment (`SOCIALDATA_API_KEY`,
`SOCIALCRAWL_API_KEY`). Improve the scripts here — this skill is their home.

## What it can do

A deliberate **subset** of what the providers expose, built around one loop:

> **search → fetch the item → fetch the author.**
> Find a live post on a topic, pull it in full, look up who wrote it. That's the
> reply / lead / monitoring workflow — not a full social-data dump.

The verbs:

- **search** `<query>` — find items on a platform (posts, and where the API
  allows, users / hashtags / subreddits). Newest-first where supported.
- **profile** `<handle>` — fetch an author: bio, follower/following counts, links.
- **posts** `<handle>` — list a profile's own posts.
- **post** `<url|id>` — fetch one item in full.
- **comments** `<url>` — fetch the replies/comment thread under an item.
- **followers** / **trending** / **transcript** — extra reach on platforms that
  expose them (see the full surface below).

### Capability matrix — target (at par with socialcrawl)

Legend: **✓** wired in the client now · **○** available in the API, not yet
implemented · **—** provider has no such endpoint. Bring `○` online by extending
the scripts; the endpoint paths are in the appendix.

| Platform | Provider | search | profile | user posts | fetch item | comments | followers | trending |
|----------|----------|--------|---------|-----------|-----------|----------|-----------|----------|
| **X** | **socialdata** | ✓ posts `Latest`\|`Top` | ✓ +`followers` | ○ via search | ✓ by id | ○ replies via search | ✓ count | — |
| **X** | socialcrawl | ○ **AI-search only** (no `Latest`/`Top`) | ○ +`/full` | ○ `/user/tweets` | ○ `/tweet` +transcript | — | ○ in profile | ○ communities |
| **Instagram** | socialcrawl | ✓ hashtag · ○ profiles/reels/location/music | ✓ | ✓ +reels/full | ✓ +stats | ○ | ○ +similar | ○ reels/music |
| **Threads** | socialcrawl | ✓ text · ○ users | ✓ | ✓ | ✓ | — | ○ in profile | — |
| **TikTok** | socialcrawl | ✓ text (`sort`,`date`,`region`) | ○ +region/full | ○ videos | ○ +transcript | ○ +replies | ○ +audience/live | ○ +songs |
| **LinkedIn** | socialcrawl | ✓ posts (`date`) · ○ people/jobs | ○ | ○ +images/videos | ○ | ○ +replies | ○ companies/groups | — |
| **Reddit** | socialcrawl | ✓ text (`sort`,`timeframe`) · ○ omni/subreddit | — | — | ✓ +transcript | ✓ | — | — |
| **YouTube** | socialcrawl | ✓ text (`sort`,`date`) · ○ advanced/hashtag | ○ channel | ✓ channel videos | ✓ +transcript/subs | ✓ +replies | ○ subscribers | ○ shorts/videos |
| **Pinterest** | socialcrawl | ✓ pins | ○ boards | ○ boards | ○ pin | — | — | — |
| **Rumble** | socialcrawl | ✓ videos | ○ channel | ○ channel videos | ○ video | — | — | — |
| **Spotify** | socialcrawl | ✓ catalog | — | — | ○ podcast/episode | — | — | — |
| **Hacker News** | socialcrawl | ✓ text (`tags`) | ○ user | — | ○ story | ○ story comments | — | — |
| **FB Ad Library** | socialcrawl | ✓ ads (`country`) · ○ companies | — | — | ○ ad | — | — | — |
| **FB Marketplace** | socialcrawl | ✓ listings (needs `lat`/`lng`) | — | — | ○ item | — | — | — |
| **FB Events** | socialcrawl | ✓ events | — | — | ○ event | — | — | — |
| **Facebook** (organic) | socialcrawl | — (no post search) | ○ page | ○ +group/reels/photos | ○ post | ○ +replies | — | — |
| **Bluesky** | socialcrawl | — | ○ | ○ | ○ | — | — | — |
| **Truth Social** | socialcrawl | — | ○ | ○ | ○ | — | — | — |
| **Snapchat** | socialcrawl | — | ○ | — | — | — | — | — |
| **Google** (web) | socialcrawl | ✓ `date_posted`,`region` | — | — | ○ | — | — | — |
| **Google News** | socialcrawl | ✓ `time_range`,`publisher` | — | — | — | — | — | — |
| **Naver** | socialcrawl | ○ blog/news/cafe (not wired — Korean portal, off-angle) | — | — | — | — | — | — |

Non-social surface socialcrawl also exposes (out of this skill's angle, but there
if wanted): commerce (Amazon, eBay, Walmart, Target, Home Depot, TikTok Shop),
app stores (App Store, Google Play), search/AI (Google, Google News/Trends/
Shopping/Finance, Tavily, Perplexity), GitHub, Spotify, Twitch, Rumble, Kick,
Web scraping + content analysis. Full map: 48 platforms / 380 endpoints.

### X: socialdata vs socialcrawl (the difference)

The two providers cover X **differently**, not redundantly:

- **socialdata is the only real keyword search for X** — `type=Latest|Top`,
  paginated, cheap ($0.20/1k). This is what the follower-growth reply workflow
  needs, and socialcrawl **cannot** do it.
- **socialcrawl's X is fetch-oriented, not search** — profile, a user's tweets,
  a single tweet (+ transcript), and communities, via `/twitter/ai-search` for a
  semantic lookup. No `Latest`/`Top` feed search.

So: **X search → socialdata, always.** socialcrawl's X is only worth wiring for
its extras (tweet transcript, community tweets) if a task needs them.

| Provider | Covers | Auth | Cost |
|----------|--------|------|------|
| **socialdata.tools** | **X / Twitter only** | `Authorization: Bearer <key>` | **$0.20 / 1k items** — per tweet or user |
| **socialcrawl.dev** | **48 platforms** (Instagram, Threads, TikTok, LinkedIn, Reddit, YouTube, Facebook, Bluesky, Pinterest, Google, HN, …) incl. X | `x-api-key: <key>` | credit-based: 1 cr standard call, ~3 cr typical, **20 cr universal search** |

## Which provider

```
platform == x / twitter?
    ├─ want cheapest + deepest tweet data  → socialdata.tools
    └─ already using socialcrawl, one key   → socialcrawl.dev  (pricier for X)
anything else                               → socialcrawl.dev  (only option)
```

- **X → prefer socialdata.** ~10–50× cheaper per item and richer tweet objects
  (likes, retweets, views, isReply, mp4 media variants). Use socialcrawl for X
  only when the user wants a single provider/key for everything.
- **Everything not-X → socialcrawl.** It's the only one that covers those.

## Getting a key — first-time setup

Neither provider bills through this skill — the user brings their own key. On
**first setup** (no `SOCIALCRAWL_API_KEY` in the environment yet), show the user
the referral link so they sign up through it:

> **Sign up for socialcrawl.dev here → https://www.socialcrawl.dev/?ref=H8Y2UQK8**
> Signing up through this link starts your account at **500 credits instead of
> 100.** Grab the API key from the dashboard, then set `SOCIALCRAWL_API_KEY`.

- **socialcrawl.dev** — primary provider, covers X + 47 more. Referral link above.
  Set `SOCIALCRAWL_API_KEY`.
- **socialdata.tools** — optional, X-only, cheaper/deeper for tweets. Sign up
  (free trial, no card), set `SOCIALDATA_API_KEY`. Only needed for cheap/deep X.

Read keys from the environment. Never print a key, never write one to a file.

## socialdata.tools (X)

Base `https://api.socialdata.tools`. Bearer auth. Billed per item returned.

| Want | Call |
|------|------|
| Profile (incl. `followers_count`) | `GET /twitter/user/{username}` |
| Search posts | `GET /twitter/search?query=..&type=Latest\|Top` — ~20/page, `next_cursor` |
| Single post | `GET /twitter/tweets/{id}` |

`type=Latest` = recency (default for "live conversation" use). `type=Top` =
engagement ranking.

## socialcrawl.dev (everything else)

Base `https://www.socialcrawl.dev/v1`. `x-api-key` header. One unified
Author/Post schema. Invoke: `bun scripts/socialcrawl.ts search "<query>"
--platform <p> [flags]`.

**Search wired in the client** (`--platform` values):

| Platform | Endpoint + flags |
|----------|------------------|
| instagram | `/instagram/search/hashtag?hashtag=` — hashtag only (strips `#`); `--type top\|recent\|clips` |
| threads | `/threads/search?query=` — `--limit N` |
| reddit | `/reddit/search?query=` — `--sort relevance\|new\|top\|comment_count` `--timeframe all\|day\|week\|month\|year` |
| youtube | `/youtube/search?query=&includeExtras=true` — `--sort relevance\|popular` `--timeframe today\|this_week\|this_month\|this_year` |
| tiktok | `/tiktok/search?query=` — `--sort relevance\|most-liked\|date-posted` `--timeframe yesterday\|this-week\|this-month\|last-3-months\|last-6-months\|all-time` `--region US` |
| linkedin | `/linkedin/search/posts?query=` — `--timeframe <date_posted>` (Google-indexed, sparse) |
| pinterest | `/pinterest/search?query=` |
| rumble | `/rumble/search?query=` |
| spotify | `/spotify/search?query=` |
| hackernews | `/hackernews/search?query=` — `--tags story\|comment\|show_hn\|ask_hn\|author_<u>` |
| fb-ads | `/facebook/adlibrary/search/ads?query=` — `--country US` |
| fb-events | `/facebook/events/search?query=` |
| fb-market | `/facebook/marketplace/search?query=&lat=&lng=` — `--lat` `--lng` required |
| google | `/google/search?query=` — `--timeframe last-hour\|last-day\|last-week\|last-month\|last-year` `--region US` (title+snippet+link, no stats) |
| google-news | `/google_news/search?keyword=` — `--timeframe hour\|day\|week\|month\|year` `--publisher bbc.com` (outlet as author) |

**Fetch verbs wired** (`profile` / `posts` / `post` / `comments`): instagram,
threads (profile/posts/post); reddit, youtube (post + comments; youtube channel
videos). Others fetch-only per the matrix — extend the script to reach them.

The provider has **48 platforms / 380 endpoints** total. Everything not above is
in the endpoint appendix; add to `scripts/socialcrawl.ts` as needed. Full map:
`https://www.socialcrawl.dev/docs/api-reference`.

## Recency-first by default

Most social-search asks are "find the live conversation to jump into," not
all-time top. Sort **newest over a tight window** unless the user says otherwise:

| platform | recency flag |
|----------|--------------|
| x (socialdata) | `--type Latest` |
| reddit | `--sort new` (+ `--timeframe day\|week\|month`) |
| youtube | `--timeframe this_week` (uploadDate) |
| tiktok | `--sort date-posted` (+ `--timeframe this-week`) |

## Gotchas

- **instagram search is hashtag-only** on socialcrawl — pass a hashtag, not free text.
- **only reddit + youtube expose comments** in the client today.
- **LinkedIn search is Google-indexed and fuzzy** — it returns real, full posts
  but often off-topic. The client applies a **client-side relevance filter**
  (contiguous phrase, plus the despaced form so "Better Stack" also matches
  "BetterStack"), **auto-on for linkedin**. Override the phrase with
  `--match "<phrase>"`; disable with `--loose`. A `0 results (dropped N)` means
  LinkedIn genuinely surfaced nothing on topic — that's honest, not a bug. For
  precise brand/topic discovery prefer Reddit / HN / YouTube; use LinkedIn for
  profile/company fetch.
- **socialcrawl universal search = 20 credits.** Prefer a specific
  per-platform endpoint when you know the platform; reserve universal search for
  genuine cross-platform sweeps.
- **X on socialcrawl costs far more** than the same query on socialdata. Route
  X to socialdata whenever the user has that key.
- **When asked "what can this do?"** show the capability matrix above — it's the
  honest state of the skill, per platform, per verb.

## Endpoint appendix — socialcrawl (the implement-later spec)

Real endpoint paths per social platform, base `https://www.socialcrawl.dev/v1`,
`x-api-key` header. `✓` = already wired in `scripts/socialcrawl.ts`. Use this to
bring the `○` cells in the matrix online.

**Twitter / X** (fetch-only, no feed search)
`/twitter/ai-search` · `/twitter/profile` · `/twitter/profile/full` ·
`/twitter/user/tweets` · `/twitter/tweet` · `/twitter/tweet/transcript` ·
`/twitter/community` · `/twitter/community/tweets`

**Instagram**
`/instagram/search/hashtag` ✓ · `/instagram/search/profiles` ·
`/instagram/search/reels` · `/instagram/search/location` ·
`/instagram/search/music` · `/instagram/profile` ✓ · `/instagram/basic-profile` ·
`/instagram/profile/posts` ✓ · `/instagram/profile/reels` ·
`/instagram/post` ✓ · `/instagram/post/stats` · `/instagram/post/comments` ·
`/instagram/followers` · `/instagram/following` · `/instagram/similar` ·
`/instagram/reels/trending` · `/instagram/music/trending`

**Threads**
`/threads/search` ✓ · `/threads/search/users` · `/threads/profile` ✓ ·
`/threads/user/posts` ✓ · `/threads/post` ✓

**TikTok**
`/tiktok/search` ✓ · `/tiktok/search/hashtag` · `/tiktok/search/top` ·
`/tiktok/search/users` · `/tiktok/profile` · `/tiktok/profile/full` ·
`/tiktok/profile/region` · `/tiktok/profile/videos` · `/tiktok/post` ·
`/tiktok/post/comments` · `/tiktok/video/comment/replies` · `/tiktok/comment` ·
`/tiktok/post/transcript` · `/tiktok/video/screen-text` · `/tiktok/song` ·
`/tiktok/song/videos` · `/tiktok/trending` · `/tiktok/user/followers` ·
`/tiktok/user/following` · `/tiktok/user/audience` · `/tiktok/user/live`

**LinkedIn**
`/linkedin/search/posts` ✓ · `/linkedin/search/people` · `/linkedin/search/jobs` ·
`/linkedin/profile` · `/linkedin/profile/posts` · `/linkedin/profile/images` ·
`/linkedin/profile/videos` · `/linkedin/profile/comments` · `/linkedin/post` ·
`/linkedin/post/comments` · `/linkedin/post/comments/replies` ·
`/linkedin/company` · `/linkedin/company/people` · `/linkedin/company/jobs`

**Reddit**
`/reddit/search` ✓ · `/reddit/omni-search` · `/reddit/subreddit` ·
`/reddit/subreddit/details` · `/reddit/subreddit/search` · `/reddit/post` ✓ ·
`/reddit/post/comments` ✓ · `/reddit/post/transcript`

**YouTube**
`/youtube/search` ✓ · `/youtube/search/advanced` · `/youtube/search/hashtag` ·
`/youtube/search/suggestions` · `/youtube/channel` · `/youtube/channel/videos` ✓ ·
`/youtube/channel/shorts` · `/youtube/channel/playlists` ·
`/youtube/channel/community-posts` · `/youtube/video` ✓ ·
`/youtube/video/comments` ✓ · `/youtube/video/comment/replies` ·
`/youtube/video/transcript` · `/youtube/video/subtitles` ·
`/youtube/videos/trending` · `/youtube/shorts/trending`

**Facebook**
`/facebook/profile` · `/facebook/profile/posts` · `/facebook/group/posts` ·
`/facebook/profile/reels` · `/facebook/profile/photos` · `/facebook/post` ·
`/facebook/post/comments` · `/facebook/post/comment/replies` ·
`/facebook/adlibrary/search/ads` ✓ · `/facebook/events/search` ✓ ·
`/facebook/marketplace/search` ✓ · `/facebook/marketplace/item`

**Hacker News**
`/hackernews/search` ✓ · `/hackernews/profile` · `/hackernews/story` ·
`/hackernews/story/comments`

**Bluesky** `/bluesky/profile` · `/bluesky/user/posts` · `/bluesky/post`
**Pinterest** `/pinterest/search` ✓ · `/pinterest/pin` · `/pinterest/board` · `/pinterest/user/boards` · `/pinterest/url-stats`
**Rumble** `/rumble/search` ✓ · `/rumble/channel/videos` · `/rumble/video`
**Spotify** `/spotify/search` ✓ · `/spotify/podcast` · `/spotify/episode`
**Google** `/google/search` ✓ (web) · **Google News** `/google_news/search` ✓ (uses `keyword=`, not `query=`)
**Truth Social** `/truthsocial/profile` · `/truthsocial/user/posts` · `/truthsocial/post`
**Snapchat** `/snapchat/profile`

For the exact params + response schema of any endpoint, read
`https://www.socialcrawl.dev/llms-full.txt` (or the `/docs/api-reference` page).
Billing: standard 1cr, advanced 5cr, premium 10cr per call — check the tier
before wiring a hot-loop endpoint.
