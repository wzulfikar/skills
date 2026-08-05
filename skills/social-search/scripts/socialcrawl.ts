#!/Users/wzulfikar/.bun/bin/bun
// name: socialcrawl
// description: Search + fetch across socialcrawl.dev — native keyword search for IG/Threads/Reddit/YouTube/TikTok/LinkedIn/Pinterest/Rumble/Spotify/HN + FB ads/events/marketplace; profile/posts/post/comments fetch. (X search → socialdata.ts)
// created: 2026-08-04
// workspace: —
//
// API: https://www.socialcrawl.dev  (docs: https://www.socialcrawl.dev/docs/api-reference)
//   Base https://www.socialcrawl.dev/v1  — responses use one unified schema
//   (Author / Post objects). Instagram: 33 endpoints, Threads: 5 endpoints.
//
//   Instagram
//     Profile  GET /v1/instagram/profile?handle=..            -> Author
//     Posts    GET /v1/instagram/profile/posts?handle=..      -> Post[]
//     Post     GET /v1/instagram/post?url=..                  -> Post
//     Search   GET /v1/instagram/search/hashtag?hashtag=..    -> Post[]  (hashtag only)
//   Threads
//     Profile  GET /v1/threads/profile?handle=..              -> Author
//     Posts    GET /v1/threads/user/posts?handle=..           -> Post[]
//     Post     GET /v1/threads/post?url=..                    -> Post
//     Search   GET /v1/threads/search?query=..                -> Post[]
//   Reddit
//     Search   GET /v1/reddit/search?query=..                 -> Post[]
//              params: sort=relevance|new|top|comment_count, timeframe=all|day|week|month|year
//     Post     GET /v1/reddit/post?url=..                     -> Post
//     Comments GET /v1/reddit/post/comments?url=..            -> Comment[]
//   YouTube
//     Search   GET /v1/youtube/search?query=..                -> Post[]
//              params: sortBy=relevance|popular, type=videos|shorts|channels|playlists,
//                      uploadDate=today|this_week|this_month|this_year, includeExtras=true
//     Video    GET /v1/youtube/video?url=..                   -> Post
//     Comments GET /v1/youtube/video/comments?url=..          -> Comment[]
//              params: order=top|newest, searchTerm=.., format=plainText
//
//   Reddit & YouTube (and IG/Threads) return one canonical wrapper per item:
//   data.items[] = { post: {...}, computed: {...} } for post lists, and
//   data.items[] = { comment: {...} } for comment lists. The formatters below
//   unwrap `.post` / `.comment` defensively so a bare or wrapped item both work.
//
// Auth: SOCIALCRAWL_API_KEY, sent as the `x-api-key` header. Taken from the
// environment if set, else read from the manager root .envrc (so
// `mngr script socialcrawl ...` works with or without direnv loaded). The key
// is never printed.
//
// Usage:
//   mngr script socialcrawl profile  <handle> [--platform instagram|threads]
//   mngr script socialcrawl posts    <handle> [--platform ...] [--limit N]
//   mngr script socialcrawl search   "<query>" [--platform ...] [--limit N] [--sort ..] [--timeframe ..]
//     (instagram search is hashtag-only — the query is treated as a hashtag;
//      reddit and youtube take a free-text query)
//   mngr script socialcrawl post     <url>    [--platform ...]
//   mngr script socialcrawl comments <url>    [--platform reddit|youtube] [--limit N] [--order ..]
//   add --json to any command for raw JSON

import { readFileSync } from "fs";

const ROOT = new URL("..", import.meta.url).pathname;
const BASE = "https://www.socialcrawl.dev/v1";

function apiKey(): string {
  if (process.env.SOCIALCRAWL_API_KEY) return process.env.SOCIALCRAWL_API_KEY;
  // Fallback: pull it out of the manager root .envrc without shelling out.
  try {
    const envrc = readFileSync(`${ROOT}.envrc`, "utf8");
    const m = envrc.match(/^\s*export\s+SOCIALCRAWL_API_KEY\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  console.error("SOCIALCRAWL_API_KEY not found in env or .envrc");
  process.exit(1);
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-api-key": apiKey(), Accept: "application/json" },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`socialcrawl ${res.status} on ${path}\n${body}`);
    process.exit(1);
  }
  return JSON.parse(body);
}

function fmt(n: number | undefined | null): string {
  return (n ?? 0).toLocaleString("en-US");
}

// The API returns one unified shape, but different deployments wrap it
// differently. Unwrap a `{ data: ... }` / `{ result: ... }` envelope if present.
function unwrap(res: any): any {
  if (res && typeof res === "object" && !Array.isArray(res)) {
    if ("data" in res) return res.data;
    if ("result" in res) return res.result;
  }
  return res;
}

// Pull the array of posts out of whatever the endpoint returned. Reddit/YouTube
// (and IG/Threads per the spec) wrap each item as { post, computed }; unwrap the
// `.post` so callers always get the canonical Post object.
function toPosts(res: any): any[] {
  const d = unwrap(res);
  const arr = Array.isArray(d)
    ? d
    : (["posts", "items", "results", "data"]
        .map((k) => (d && Array.isArray(d[k]) ? d[k] : null))
        .find((v) => v) ?? (d ? [d] : []));
  return arr.map((it: any) => (it && typeof it === "object" && it.post ? it.post : it));
}

// Same, for comment lists: data.items[] = { comment: {...} }.
function toComments(res: any): any[] {
  const d = unwrap(res);
  const arr = Array.isArray(d)
    ? d
    : (["comments", "items", "results", "data"]
        .map((k) => (d && Array.isArray(d[k]) ? d[k] : null))
        .find((v) => v) ?? (d ? [d] : []));
  return arr.map((it: any) => (it && typeof it === "object" && it.comment ? it.comment : it));
}

// ---- formatting for the unified Author / Post objects ----

function printAuthor(a: any) {
  const handle = a.username ?? a.handle ?? "?";
  console.log(`@${handle}  ${a.display_name ?? ""}${a.verified ? " ✓" : ""}`.trimEnd());
  if (a.bio) console.log(a.bio);
  console.log(
    `followers ${fmt(a.followers)}  following ${fmt(a.following)}  ` +
      `posts ${fmt(a.posts_count)}` +
      (a.likes_count != null ? `  likes ${fmt(a.likes_count)}` : ""),
  );
  if (a.private) console.log("(private account)");
  if (a.location) console.log(`location: ${a.location}`);
  if (a.external_url) console.log(`link: ${a.external_url}`);
  if (a.url) console.log(a.url);
}

// The search endpoints do NOT all share one schema. IG/Threads/Reddit/YouTube/
// TikTok use { content, engagement, author }; LinkedIn uses { title, activity:
// {num_likes,…}, author:{name} }; others vary again. Coalesce across the known
// field names so every platform prints text + stats + author.
function pick(...vals: any[]) {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
}

function printPost(p: any) {
  const c = p.content ?? {};
  const e = p.engagement ?? {};
  const act = p.activity ?? {}; // linkedin
  const au = p.author ?? {};
  const when = pick(p.published_at, p.created_at, p.date, "");
  const likes = pick(e.likes, act.num_likes, p.likes, p.like_count);
  const comments = pick(e.comments, act.num_comments, p.comments, p.comment_count);
  const views = pick(e.views, p.views, p.view_count, p.play_count);
  const shares = pick(e.shares, act.num_shares, p.shares);
  const saves = pick(e.saves, p.saves);
  const who = pick(au.username, au.name, au.handle, "?");
  console.log(
    `\n@${who}${au.verified ? " ✓" : ""}` +
      (when ? ` · ${when}` : "") +
      `  ❤ ${fmt(likes)} 💬 ${fmt(comments)}` +
      (views != null ? ` 👁 ${fmt(views)}` : "") +
      (shares != null ? ` 🔁 ${fmt(shares)}` : "") +
      (saves != null ? ` 🔖 ${fmt(saves)}` : ""),
  );
  const text = String(pick(c.text, p.title, p.text, p.description, p.caption, "")).replace(
    /\n/g,
    " ",
  );
  if (text) console.log(text);
  if (p.url) console.log(p.url);
}

function printComment(cm: any) {
  const e = cm.engagement ?? {};
  const au = cm.author ?? {};
  const when = cm.published_at ?? "";
  console.log(
    `\n@${au.username ?? au.handle ?? "?"}${au.verified ? " ✓" : ""}` +
      (when ? ` · ${when}` : "") +
      `  ❤ ${fmt(e.likes)} 💬 ${fmt(e.replies ?? e.comments)}`,
  );
  const text = (cm.text ?? "").replace(/\n/g, " ");
  if (text) console.log(text);
  if (cm.url) console.log(cm.url);
}

// ---- commands ----

async function profile(handle: string, platform: string, json: boolean) {
  const res = await get(`/${platform}/profile?handle=${encodeURIComponent(handle)}`);
  if (json) return console.log(JSON.stringify(res, null, 2));
  printAuthor(unwrap(res));
}

async function posts(handle: string, platform: string, limit: number, json: boolean) {
  // Each platform lists a profile's posts at its own path.
  const paths: Record<string, string> = {
    threads: `/threads/user/posts?handle=${encodeURIComponent(handle)}`,
    instagram: `/instagram/profile/posts?handle=${encodeURIComponent(handle)}`,
    youtube: `/youtube/channel/videos?channel=${encodeURIComponent(handle)}`,
  };
  const path = paths[platform];
  if (!path) {
    console.error(`'posts' is not supported for platform '${platform}'`);
    process.exit(1);
  }
  const res = await get(path);
  const out = toPosts(res).slice(0, limit);
  if (json) return console.log(JSON.stringify(out, null, 2));
  for (const p of out) printPost(p);
  console.log(`\n${out.length} post(s)`);
}

// ---- search ----
// Every socialcrawl platform with a native keyword-search endpoint. Each entry
// builds the path from the query plus whatever optional flags that endpoint
// accepts; the base path always carries the required query/hashtag param, so
// optional flags append with `&`. Item shapes differ per platform but all
// normalize through toPosts/printPost (content/author/engagement).
//
// Common flags: --sort, --timeframe (aka --date), --limit. Platform-specifics:
//   instagram  --type top|recent|clips
//   reddit     --sort relevance|new|top|comment_count  --timeframe all|day|week|month|year
//   youtube    --sort relevance|popular                --timeframe today|this_week|this_month|this_year
//   tiktok     --sort relevance|most-liked|date-posted --timeframe yesterday|this-week|this-month|last-3-months|last-6-months|all-time  --region US
//   linkedin   --timeframe <date_posted>
//   hackernews --tags story|comment|show_hn|ask_hn|author_<user>
//   fb-ads     --country US
//   fb-market  --lat <n> --lng <n>  (required — Marketplace is location-scoped)
type Flags = Record<string, string>;
const enc = encodeURIComponent;

const SEARCH: Record<string, (q: string, f: Flags) => string> = {
  instagram: (q, f) =>
    `/instagram/search/hashtag?hashtag=${enc(q.replace(/^#/, ""))}` +
    (f.type ? `&type=${enc(f.type)}` : ""),
  threads: (q, f) =>
    `/threads/search?query=${enc(q)}` + (f.limit ? `&limit=${enc(f.limit)}` : ""),
  reddit: (q, f) =>
    `/reddit/search?query=${enc(q)}` +
    (f.sort ? `&sort=${enc(f.sort)}` : "") +
    (f.timeframe ? `&timeframe=${enc(f.timeframe)}` : ""),
  youtube: (q, f) =>
    `/youtube/search?query=${enc(q)}&includeExtras=true` +
    (f.sort ? `&sortBy=${enc(f.sort)}` : "") +
    (f.timeframe ? `&uploadDate=${enc(f.timeframe)}` : ""),
  tiktok: (q, f) =>
    `/tiktok/search?query=${enc(q)}` +
    (f.sort ? `&sort_by=${enc(f.sort)}` : "") +
    (f.timeframe ? `&date_posted=${enc(f.timeframe)}` : "") +
    (f.region ? `&region=${enc(f.region)}` : ""),
  linkedin: (q, f) =>
    `/linkedin/search/posts?query=${enc(q)}` +
    (f.timeframe ? `&date_posted=${enc(f.timeframe)}` : ""),
  pinterest: (q) => `/pinterest/search?query=${enc(q)}`,
  rumble: (q) => `/rumble/search?query=${enc(q)}`,
  spotify: (q) => `/spotify/search?query=${enc(q)}`,
  hackernews: (q, f) =>
    `/hackernews/search?query=${enc(q)}` + (f.tags ? `&tags=${enc(f.tags)}` : ""),
  "fb-ads": (q, f) =>
    `/facebook/adlibrary/search/ads?query=${enc(q)}` +
    (f.country ? `&country=${enc(f.country)}` : ""),
  "fb-events": (q) => `/facebook/events/search?query=${enc(q)}`,
  "fb-market": (q, f) =>
    `/facebook/marketplace/search?query=${enc(q)}&lat=${enc(f.lat)}&lng=${enc(f.lng)}`,
};

const SEARCH_PLATFORMS = Object.keys(SEARCH);

async function search(
  query: string,
  platform: string,
  limit: number,
  json: boolean,
  flags: Flags,
) {
  const build = SEARCH[platform];
  if (!build) {
    console.error(
      `search not supported for '${platform}'.\n` +
        `native search: ${SEARCH_PLATFORMS.join(", ")}\n` +
        `(for X, use socialdata.ts — socialcrawl has no Latest/Top feed search)`,
    );
    process.exit(1);
  }
  if (platform === "fb-market" && (!flags.lat || !flags.lng)) {
    console.error("fb-market search needs --lat and --lng (Marketplace is location-scoped)");
    process.exit(1);
  }
  const res = await get(build(query, flags));
  const out = toPosts(res).slice(0, limit);
  if (json) return console.log(JSON.stringify(out, null, 2));
  for (const p of out) printPost(p);
  console.log(`\n${out.length} result(s)`);
}

async function post(url: string, platform: string, json: boolean) {
  // Reddit uses /reddit/post, YouTube uses /youtube/video, others /<p>/post.
  const path =
    platform === "youtube"
      ? `/youtube/video?url=${encodeURIComponent(url)}`
      : `/${platform}/post?url=${encodeURIComponent(url)}`;
  const res = await get(path);
  if (json) return console.log(JSON.stringify(res, null, 2));
  const posts = toPosts(res);
  printPost(posts[0] ?? unwrap(res));
}

async function comments(
  url: string,
  platform: string,
  limit: number,
  json: boolean,
  order: string,
) {
  // Only reddit and youtube expose a comment endpoint here.
  let path: string;
  if (platform === "reddit") {
    path = `/reddit/post/comments?url=${encodeURIComponent(url)}`;
  } else if (platform === "youtube") {
    path = `/youtube/video/comments?url=${encodeURIComponent(url)}`;
    if (order) path += `&order=${encodeURIComponent(order)}`;
  } else {
    console.error(`'comments' is only supported for platform reddit or youtube`);
    process.exit(1);
  }
  const res = await get(path);
  const out = toComments(res).slice(0, limit);
  if (json) return console.log(JSON.stringify(out, null, 2));
  for (const cm of out) printComment(cm);
  console.log(`\n${out.length} comment(s)`);
}

// ---- dispatch ----

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const args = argv.filter((a) => !a.startsWith("--"));
const cmd = args[0];

function flag(name: string, def: string): string {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}

const PLATFORMS = ["instagram", "threads", "reddit", "youtube"];

function platformArg(): string {
  const p = flag("platform", "instagram").toLowerCase();
  if (!PLATFORMS.includes(p)) {
    console.error(`unknown platform '${p}' — use ${PLATFORMS.join(", ")}`);
    process.exit(1);
  }
  return p;
}

switch (cmd) {
  case "profile":
    if (!args[1]) usage();
    await profile(args[1], platformArg(), json);
    break;
  case "posts":
    if (!args[1]) usage();
    await posts(args[1], platformArg(), parseInt(flag("limit", "20"), 10), json);
    break;
  case "search":
    if (!args[1]) usage();
    await search(
      args[1],
      flag("platform", "instagram").toLowerCase(),
      parseInt(flag("limit", "20"), 10),
      json,
      {
        sort: flag("sort", ""),
        timeframe: flag("timeframe", flag("date", "")),
        type: flag("type", ""),
        region: flag("region", ""),
        tags: flag("tags", ""),
        country: flag("country", ""),
        lat: flag("lat", ""),
        lng: flag("lng", ""),
        limit: flag("limit", ""),
      },
    );
    break;
  case "post":
    if (!args[1]) usage();
    await post(args[1], platformArg(), json);
    break;
  case "comments":
    if (!args[1]) usage();
    await comments(
      args[1],
      platformArg(),
      parseInt(flag("limit", "50"), 10),
      json,
      flag("order", ""),
    );
    break;
  default:
    usage();
}

function usage(): never {
  console.error(
    [
      "fetch verbs  --platform instagram|threads|reddit|youtube  (default instagram)",
      "  socialcrawl profile  <handle> [--platform instagram|threads]",
      "  socialcrawl posts    <handle> [--platform instagram|threads|youtube] [--limit N]",
      "  socialcrawl post     <url>    [--platform ...]",
      "  socialcrawl comments <url>    [--platform reddit|youtube] [--limit N] [--order top|newest]",
      "",
      "search  --platform " + SEARCH_PLATFORMS.join("|"),
      '  socialcrawl search   "<query>" --platform <p> [--limit N] [--sort ..] [--timeframe ..]',
      "                                 [--type ..] [--region ..] [--tags ..] [--country ..] [--lat --lng]",
      "                                 (instagram=hashtag-only; fb-market needs --lat/--lng)",
      "  for X search use socialdata.ts — socialcrawl has no Latest/Top feed search",
      "  (add --json for raw output)",
    ].join("\n"),
  );
  process.exit(1);
}
