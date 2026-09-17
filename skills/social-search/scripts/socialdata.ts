#!/Users/wzulfikar/.bun/bin/bun
// name: socialdata
// description: Query X (Twitter) via socialdata.tools — search posts, get a profile, get a post
// created: 2026-07-29
// workspace: —
//
// API: https://socialdata.tools  (docs: https://docs.socialdata.tools)
//   Profile   GET /twitter/user/{username}          -> profile incl. followers_count
//   Search    GET /twitter/search?query=..&type=..  -> ~20 posts/page, next_cursor
//   Post      GET /twitter/tweets/{id}              -> single post w/ stats
//
// Auth: SOCIALDATA_API_KEY. This is a SHARED, account-wide key (same for
// every project), so it is taken from the environment if set, else from
// ~/manager/.envrc — never from the current project's env files, which would
// let a per-project .envrc silently shadow the shared key. The key is never
// printed.
//
// Usage:
//   mngr script socialdata profile <username>              profile summary
//   mngr script socialdata followers <username>            just the follower count (for goal check)
//   mngr script socialdata search "<query>" [--type Latest|Top] [--limit N]
//   mngr script socialdata post <id>                       single post
//   add --json to any command for raw JSON

import { readFileSync } from "fs";
import { homedir } from "os";

const BASE = "https://api.socialdata.tools";

// Shared, account-wide key: same for every project, so this deliberately
// never reads a cwd env file. env first, then the one known location, then a
// hard error — no cwd fallback.
function apiKey(): string {
  if (process.env.SOCIALDATA_API_KEY) return process.env.SOCIALDATA_API_KEY;
  try {
    const envrc = readFileSync(`${homedir()}/manager/.envrc`, "utf8");
    const m = envrc.match(/^\s*(?:export\s+)?SOCIALDATA_API_KEY\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  console.error("SOCIALDATA_API_KEY not found in environment or ~/manager/.envrc (shared key)");
  process.exit(1);
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`socialdata ${res.status} on ${path}\n${body}`);
    process.exit(1);
  }
  return JSON.parse(body);
}

function fmt(n: number | undefined): string {
  return (n ?? 0).toLocaleString("en-US");
}

// ---- commands ----

async function profile(username: string, json: boolean) {
  const u = await get(`/twitter/user/${encodeURIComponent(username)}`);
  if (json) return console.log(JSON.stringify(u, null, 2));
  console.log(`@${u.screen_name}  ${u.name}${u.verified ? " ✓" : ""}`);
  if (u.description) console.log(u.description);
  console.log(
    `followers ${fmt(u.followers_count)}  following ${fmt(u.friends_count)}  ` +
      `posts ${fmt(u.statuses_count)}  listed ${fmt(u.listed_count)}`,
  );
  if (u.location) console.log(`location: ${u.location}`);
  console.log(`joined: ${u.created_at}`);
}

async function followers(username: string) {
  const u = await get(`/twitter/user/${encodeURIComponent(username)}`);
  // Bare number so it's easy to pipe into `mngr goal check`.
  console.log(u.followers_count);
}

async function search(query: string, type: string, limit: number, json: boolean) {
  const posts: any[] = [];
  let cursor: string | undefined;
  while (posts.length < limit) {
    let path = `/twitter/search?query=${encodeURIComponent(query)}&type=${type}`;
    if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;
    const page = await get(path);
    const batch = page.tweets ?? [];
    posts.push(...batch);
    cursor = page.next_cursor;
    if (!cursor || batch.length === 0) break;
  }
  const out = posts.slice(0, limit);
  if (json) return console.log(JSON.stringify(out, null, 2));
  for (const t of out) {
    const u = t.user ?? {};
    console.log(
      `\n@${u.screen_name} · ${t.tweet_created_at}  ` +
        `❤ ${fmt(t.favorite_count)} 🔁 ${fmt(t.retweet_count)} 💬 ${fmt(t.reply_count)} 👁 ${fmt(t.views_count)}`,
    );
    console.log((t.full_text ?? t.text ?? "").replace(/\n/g, " "));
    console.log(`https://x.com/${u.screen_name}/status/${t.id_str}`);
  }
  console.log(`\n${out.length} post(s)`);
}

async function post(id: string, json: boolean) {
  const t = await get(`/twitter/tweets/${encodeURIComponent(id)}`);
  if (json) return console.log(JSON.stringify(t, null, 2));
  const u = t.user ?? {};
  console.log(`@${u.screen_name} · ${t.tweet_created_at}`);
  console.log(t.full_text ?? t.text ?? "");
  console.log(
    `❤ ${fmt(t.favorite_count)} 🔁 ${fmt(t.retweet_count)} 💬 ${fmt(t.reply_count)} ` +
      `📌 ${fmt(t.quote_count)} 👁 ${fmt(t.views_count)}`,
  );
  console.log(`https://x.com/${u.screen_name}/status/${t.id_str}`);
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

switch (cmd) {
  case "profile":
    if (!args[1]) usage();
    await profile(args[1], json);
    break;
  case "followers":
    if (!args[1]) usage();
    await followers(args[1]);
    break;
  case "search":
    if (!args[1]) usage();
    await search(args[1], flag("type", "Latest"), parseInt(flag("limit", "20"), 10), json);
    break;
  case "post":
    if (!args[1]) usage();
    await post(args[1], json);
    break;
  default:
    usage();
}

function usage(): never {
  console.error(
    [
      "usage:",
      "  socialdata profile <username>",
      "  socialdata followers <username>",
      '  socialdata search "<query>" [--type Latest|Top] [--limit N]',
      "  socialdata post <id>",
      "  (add --json for raw output)",
    ].join("\n"),
  );
  process.exit(1);
}
