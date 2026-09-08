#!/usr/bin/env bun
// name: seo-indexnow
// description: Push changed URLs at Bing/Yandex/Seznam/Naver/Yep via the IndexNow protocol — free, no account, no quota
// created: 2026-09-02
// workspace: none
//
// API: https://api.indexnow.org/indexnow  (docs: https://www.indexnow.org/documentation)
//   Submit  POST /indexnow   { host, key, keyLocation, urlList }  -> up to 10,000 URLs
//   Submit  GET  /indexnow?url=<u>&key=<k>                        -> single URL
//
// Free. No auth header, no API key registration, no per-day cap. Ownership is
// proved by hosting a file at https://<host>/<key>.txt whose entire contents
// are the key. api.indexnow.org fans one call out to every participating
// engine, so submit there once rather than to each engine separately.
//
// NOT GOOGLE. Google does not participate in IndexNow. This buys you Bing —
// which is what ChatGPT search leans on — plus Yandex, Seznam, Naver, Yep.
//
// ONLY PING REAL CHANGES. There is no published rate limit, but engines apply
// quality scoring: a site that re-submits unchanged URLs gets its submissions
// discounted or ignored. `sitemap --since` exists so a deploy hook can send the
// pages that actually moved instead of the whole site every time.
//
// Usage:
//   indexnow key                              generate a key + where to put the file
//   indexnow check <host>                     is the key file live and correct
//   indexnow submit <url> [url...]            one batched POST
//   indexnow sitemap <sitemap-url>            pull URLs out of a sitemap, submit them
//   flags: --since <YYYY-MM-DD>  --dry  --engine <name>  --key <k>  --key-location <url>  --json

import { readFileSync } from "fs";

const ENGINES: Record<string, string> = {
  default: "https://api.indexnow.org/indexnow",
  bing: "https://www.bing.com/indexnow",
  yandex: "https://yandex.com/indexnow",
  seznam: "https://search.seznam.cz/indexnow",
  naver: "https://searchadvisor.naver.com/indexnow",
};

const MAX_URLS = 10_000;

// IndexNow's own status vocabulary. 200 means "accepted", never "indexed".
const MEANING: Record<number, string> = {
  200: "OK — accepted (not the same as indexed)",
  202: "Accepted, key still pending validation — the key file was not fetched yet",
  400: "Bad request — malformed JSON or missing field",
  403: "Forbidden — key file missing, unreadable, or contents do not match",
  422: "Unprocessable — a URL does not belong to `host`, or key/host mismatch",
  429: "Too many requests — throttled, likely flagged as spam",
};

function key(override?: string): string {
  if (override) return override;
  if (process.env.INDEXNOW_KEY) return process.env.INDEXNOW_KEY;
  for (const path of [`${process.cwd()}/.envrc`]) {
    try {
      const m = readFileSync(path, "utf8").match(
        /^\s*export\s+INDEXNOW_KEY\s*=\s*(.+?)\s*$/m,
      );
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  console.error(
    "INDEXNOW_KEY not found in env or .envrc. Run `indexnow key` to make one.",
  );
  process.exit(1);
}

// Every URL in a batch must share one host — the protocol rejects mixed batches
// with a 422, so catch it here where the message can be useful.
function hostOf(urls: string[]): string {
  const hosts = new Set(urls.map((u) => new URL(u).host));
  if (hosts.size > 1) {
    console.error(
      `all URLs must share one host, got: ${[...hosts].join(", ")}\n` +
        "Run one submit per host.",
    );
    process.exit(1);
  }
  return [...hosts][0];
}

function genKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function cmdKey() {
  const k = genKey();
  console.log(k);
  console.error(
    [
      "",
      "1. Serve this at https://<your-host>/" + k + ".txt",
      "   Contents: the key and nothing else. No newline needed, no BOM,",
      "   Content-Type text/plain, HTTP 200.",
      "     Next.js  -> public/" + k + ".txt",
      "     Static   -> <webroot>/" + k + ".txt",
      "     Worker   -> route it, or serve from assets",
      "2. export INDEXNOW_KEY=" + k + "   (add to .envrc)",
      "3. indexnow check <your-host>",
      "",
      "The key is not a secret — it is public by design, anyone can read the",
      "file. It proves you control the host, nothing more.",
      "",
    ].join("\n"),
  );
}

async function cmdCheck(host: string, k: string) {
  const url = `https://${host.replace(/^https?:\/\//, "")}/${k}.txt`;
  try {
    const res = await fetch(url);
    const body = (await res.text()).trim();
    if (!res.ok) {
      console.error(`FAIL ${res.status} fetching ${url}`);
      process.exit(1);
    }
    const ct = res.headers.get("content-type") ?? "(none)";
    if (body !== k) {
      console.error(
        `FAIL ${url} returned ${body.length} bytes that are not the key.\n` +
          "Contents must be exactly the key — no HTML, no wrapper, no extra text.\n" +
          `Got: ${JSON.stringify(body.slice(0, 80))}`,
      );
      process.exit(1);
    }
    console.log(`OK  ${url}  (content-type: ${ct})`);
    if (!ct.includes("text/plain")) {
      console.error(
        "warn: content-type is not text/plain. Usually tolerated, occasionally not.",
      );
    }
  } catch (e) {
    console.error(`FAIL could not fetch ${url}: ${(e as Error).message}`);
    process.exit(1);
  }
}

async function submit(
  urls: string[],
  k: string,
  opts: { engine: string; keyLocation?: string; dry: boolean; json: boolean },
) {
  const unique = [...new Set(urls)];
  const host = hostOf(unique);
  const keyLocation = opts.keyLocation ?? `https://${host}/${k}.txt`;
  const endpoint = ENGINES[opts.engine] ?? opts.engine;

  // Chunk rather than truncate: a caller passing 25k URLs means it.
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += MAX_URLS) {
    chunks.push(unique.slice(i, i + MAX_URLS));
  }

  if (opts.dry) {
    console.log(unique.join("\n"));
    console.error(
      `\n--dry: ${unique.length} URL(s), ${chunks.length} call(s) to ${endpoint}\n` +
        `host=${host} keyLocation=${keyLocation}`,
    );
    return;
  }

  for (const [i, chunk] of chunks.entries()) {
    const body = { host, key: k, keyLocation, urlList: chunk };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    const text = await res.text();

    if (opts.json) {
      console.log(
        JSON.stringify({ status: res.status, chunk: i + 1, count: chunk.length, body: text }),
      );
    } else {
      const label = chunks.length > 1 ? ` [chunk ${i + 1}/${chunks.length}]` : "";
      console.log(
        `${res.status} ${MEANING[res.status] ?? res.statusText} · ${chunk.length} URL(s)${label}`,
      );
      if (text.trim()) console.log(text.trim());
    }
    if (res.status >= 400) process.exitCode = 1;
  }
}

// Sitemaps nest: a <sitemapindex> points at more sitemaps. Recurse once, which
// covers every real-world layout, and stop rather than crawl forever.
async function readSitemap(
  url: string,
  depth = 0,
): Promise<{ loc: string; lastmod?: string }[]> {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAIL ${res.status} fetching sitemap ${url}`);
    process.exit(1);
  }
  let xml: string;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (url.endsWith(".gz") || (buf[0] === 0x1f && buf[1] === 0x8b)) {
    xml = new TextDecoder().decode(Bun.gunzipSync(buf));
  } else {
    xml = new TextDecoder().decode(buf);
  }

  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const entries: { loc: string; lastmod?: string }[] = [];
  const block = isIndex ? /<sitemap[\s>]([\s\S]*?)<\/sitemap>/gi : /<url[\s>]([\s\S]*?)<\/url>/gi;
  for (const m of xml.matchAll(block)) {
    const loc = m[1].match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1];
    if (!loc) continue;
    const lastmod = m[1].match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i)?.[1];
    entries.push({ loc: decodeXml(loc), lastmod });
  }

  if (!isIndex) return entries;
  if (depth > 1) {
    console.error(`warn: nested sitemap index deeper than 2 levels at ${url}, stopping`);
    return [];
  }
  const out: { loc: string; lastmod?: string }[] = [];
  for (const e of entries) out.push(...(await readSitemap(e.loc, depth + 1)));
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function cmdSitemap(
  sitemapUrl: string,
  k: string,
  since: string | undefined,
  opts: { engine: string; keyLocation?: string; dry: boolean; json: boolean },
) {
  let entries = await readSitemap(sitemapUrl);
  const total = entries.length;

  if (since) {
    const cutoff = new Date(since).getTime();
    if (Number.isNaN(cutoff)) {
      console.error(`--since is not a date: ${since}`);
      process.exit(1);
    }
    const missing = entries.filter((e) => !e.lastmod).length;
    entries = entries.filter(
      (e) => e.lastmod && new Date(e.lastmod).getTime() >= cutoff,
    );
    if (missing) {
      console.error(
        `warn: ${missing}/${total} entries have no <lastmod> and were skipped by --since`,
      );
    }
  }

  console.error(`${entries.length}/${total} URL(s) from ${sitemapUrl}`);
  if (!entries.length) return;
  await submit(entries.map((e) => e.loc), k, opts);
}

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string) => argv.includes(`--${name}`);

const opts = {
  engine: flag("engine") ?? "default",
  keyLocation: flag("key-location"),
  dry: has("dry"),
  json: has("json"),
};
const since = flag("since");
const keyOverride = flag("key");

// Positional args are everything that is not a flag or a flag's value.
const consumed = new Set<number>();
for (const name of ["engine", "key-location", "since", "key"]) {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0) { consumed.add(i); consumed.add(i + 1); }
}
const args = argv.filter(
  (a, i) => !consumed.has(i) && !a.startsWith("--"),
);

const cmd = args[0];
switch (cmd) {
  case "key":
    cmdKey();
    break;
  case "check":
    if (!args[1]) usage();
    await cmdCheck(args[1], key(keyOverride));
    break;
  case "submit":
    if (args.length < 2) usage();
    await submit(args.slice(1), key(keyOverride), opts);
    break;
  case "sitemap":
    if (!args[1]) usage();
    await cmdSitemap(args[1], key(keyOverride), since, opts);
    break;
  default:
    usage();
}

function usage(): never {
  console.error(
    [
      "usage:",
      "  indexnow key                          generate a key, print where the file goes",
      "  indexnow check <host>                 verify the key file is live and correct",
      "  indexnow submit <url> [url...]        one batched POST (chunks at 10,000)",
      "  indexnow sitemap <sitemap-url>        read a sitemap (or index) and submit it",
      "",
      "flags:",
      "  --since <YYYY-MM-DD>    sitemap only: entries with <lastmod> on/after this date",
      "  --dry                   print the URL list, send nothing",
      "  --engine <name>         default | bing | yandex | seznam | naver | <full url>",
      "  --key <k>               override INDEXNOW_KEY",
      "  --key-location <url>    override https://<host>/<key>.txt",
      "  --json                  raw status + response body per chunk",
      "",
      "Free, no account, no quota. NOT Google — Google does not participate.",
      "Submit only URLs that actually changed; re-pinging unchanged pages gets",
      "a site's submissions quality-scored down.",
    ].join("\n"),
  );
  process.exit(1);
}
