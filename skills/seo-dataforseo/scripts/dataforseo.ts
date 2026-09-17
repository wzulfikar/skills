#!/usr/bin/env bun
// name: dataforseo
// description: SEO data via DataForSEO pay-as-you-go: organic traffic estimates for many domains, keyword volume/difficulty/CPC, free balance check
// created: 2026-09-02
// workspace: none
//
// API: https://api.dataforseo.com  (docs: https://docs.dataforseo.com/v3/)
//   Balance   GET  /v3/appendix/user_data                                  -> free
//   Traffic   POST /v3/dataforseo_labs/google/bulk_traffic_estimation/live  -> up to 1000 domains/task
//   Keywords  POST /v3/dataforseo_labs/google/keyword_overview/live         -> up to 700 keywords/task
//
// Everything here is a `/live` endpoint: one request in, results out, no polling.
//
// MONEY. Cost is dominated by a flat per-task charge, not per-item, so ALWAYS
// batch. Measured 2026-09-02: 13 domains in one traffic call = $0.0136;
// 20 keywords in one keyword call = $0.0143. Looping single-item calls is how
// you burn a balance for nothing. Every billed call below prints what it cost
// and what is left (the balance re-check is free).
//
// Auth: DATAFORSEO_API_KEY is ALREADY base64("login:password"), so it goes
// straight into the header as `Authorization: Basic $DATAFORSEO_API_KEY`.
// Do not re-encode it. Taken from the environment if set, else read from a
// known .envrc. The key is never printed.
//
// Usage:
//   dataforseo balance                                  bare number, free
//   dataforseo traffic <domain> [domain...]             one batched call
//   dataforseo keywords "<kw>" ["<kw>"...]              one batched call
//   dataforseo raw <path> '<json body>'                 escape hatch, any endpoint
//   flags: --json  --location <code|2840>  --language <code|en>

import { readFileSync } from "fs";
import { homedir } from "os";

const BASE = "https://api.dataforseo.com";

// Shared, account-wide key: same for every project, so this deliberately
// never reads a cwd env file (that would let a per-project .envrc shadow the
// one shared key with something else). env first, then the one known
// location, then a hard error — no cwd fallback.
function sharedEnvVar(name: string): string {
  if (process.env[name]) return process.env[name]!;
  try {
    const envrc = readFileSync(`${homedir()}/manager/.envrc`, "utf8");
    const m = envrc.match(
      new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.+?)\\s*$`, "m"),
    );
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  console.error(
    `${name} not found in environment or ~/manager/.envrc (shared key)`,
  );
  process.exit(1);
}

function apiKey(): string {
  return sharedEnvVar("DATAFORSEO_API_KEY");
}

function headers() {
  return {
    Authorization: `Basic ${apiKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// DataForSEO answers 200 OK with a non-20000 status_code for real failures
// (bad auth, no funds, malformed body), so HTTP status alone is not enough.
function assertOk(body: any, path: string) {
  if (body.status_code !== 20000) {
    console.error(
      `dataforseo ${body.status_code} on ${path}: ${body.status_message}`,
    );
    if (String(body.status_code).startsWith("402")) {
      console.error(
        "out of funds, top up at https://app.dataforseo.com/ (min $50)",
      );
    }
    process.exit(1);
  }
  const task = body.tasks?.[0];
  if (task && task.status_code !== 20000) {
    console.error(
      `dataforseo task ${task.status_code} on ${path}: ${task.status_message}`,
    );
    process.exit(1);
  }
}

async function call(path: string, body?: any): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`dataforseo HTTP ${res.status} on ${path}\n${text}`);
    process.exit(1);
  }
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error(
      `dataforseo returned non-JSON on ${path}\n${text.slice(0, 500)}`,
    );
    process.exit(1);
  }
  assertOk(parsed, path);
  return parsed;
}

async function rawBalance(): Promise<number | null> {
  try {
    const d = await call("/v3/appendix/user_data");
    return d.tasks?.[0]?.result?.[0]?.money?.balance ?? null;
  } catch {
    return null;
  }
}

// Cost goes to stderr so `--json` stdout stays pipeable. The balance re-check
// is free, so there is no reason not to show what is left.
async function reportCost(res: any) {
  const cost = res.cost ?? 0;
  const left = await rawBalance();
  console.error(
    `\ncost $${cost.toFixed(4)}` +
      (left != null ? `  ·  balance $${left.toFixed(4)}` : ""),
  );
}

function fmt(n: number | undefined | null, digits = 0): string {
  if (n == null) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function padL(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

function items(res: any): any[] {
  return res.tasks?.[0]?.result?.[0]?.items ?? [];
}

// ---- commands ----

// Free. Bare number so it can feed a script or a goal check.
async function balance(json: boolean) {
  const d = await call("/v3/appendix/user_data");
  if (json) return console.log(JSON.stringify(d, null, 2));
  const money = d.tasks?.[0]?.result?.[0]?.money ?? {};
  console.log(money.balance ?? 0);
}

// One request, up to 1000 domains. Never call this per-domain in a loop.
async function traffic(
  domains: string[],
  loc: number,
  lang: string,
  json: boolean,
) {
  const res = await call(
    "/v3/dataforseo_labs/google/bulk_traffic_estimation/live",
    [
      {
        targets: domains,
        location_code: loc,
        language_code: lang,
        item_types: ["organic"],
      },
    ],
  );
  if (json) {
    console.log(JSON.stringify(res, null, 2));
    return reportCost(res);
  }
  const rows = items(res)
    .map((it: any) => ({
      target: it.target ?? "?",
      etv: it.metrics?.organic?.etv ?? null,
      count: it.metrics?.organic?.count ?? null,
    }))
    .sort((a, b) => (b.etv ?? -1) - (a.etv ?? -1));

  const w = Math.max(6, ...rows.map((r) => r.target.length));
  console.log(
    `${pad("domain", w)}  ${padL("visits/mo", 11)}  ${padL("keywords", 9)}`,
  );
  console.log(`${"-".repeat(w)}  ${"-".repeat(11)}  ${"-".repeat(9)}`);
  for (const r of rows) {
    console.log(
      `${pad(r.target, w)}  ${padL(fmt(r.etv), 11)}  ${padL(fmt(r.count), 9)}`,
    );
  }
  console.log(`\n${rows.length} domain(s) · location ${loc} · ${lang}`);
  console.log(
    "etv = estimated monthly organic visits. A near-zero etv on a domain you " +
      "know is big is an index artifact, not a finding, so cross-check before concluding.",
  );
  await reportCost(res);
}

// One request, many keywords. 20 keywords costs barely more than 1.
async function keywords(
  kws: string[],
  loc: number,
  lang: string,
  json: boolean,
) {
  const res = await call("/v3/dataforseo_labs/google/keyword_overview/live", [
    { keywords: kws, location_code: loc, language_code: lang },
  ]);
  if (json) {
    console.log(JSON.stringify(res, null, 2));
    return reportCost(res);
  }
  const rows = items(res)
    .map((it: any) => ({
      keyword: it.keyword ?? "?",
      volume: it.keyword_info?.search_volume ?? null,
      kd: it.keyword_properties?.keyword_difficulty ?? null,
      cpc: it.keyword_info?.cpc ?? null,
      comp: it.keyword_info?.competition_level ?? null,
    }))
    .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));

  const w = Math.max(7, ...rows.map((r) => r.keyword.length));
  console.log(
    `${pad("keyword", w)}  ${padL("volume", 8)}  ${padL("KD", 4)}  ${padL("CPC", 7)}  comp`,
  );
  console.log(
    `${"-".repeat(w)}  ${"-".repeat(8)}  ${"-".repeat(4)}  ${"-".repeat(7)}  ----`,
  );
  for (const r of rows) {
    console.log(
      `${pad(r.keyword, w)}  ${padL(fmt(r.volume), 8)}  ${padL(r.kd == null ? "-" : String(r.kd), 4)}  ` +
        `${padL(r.cpc == null ? "-" : `$${r.cpc.toFixed(2)}`, 7)}  ${(r.comp ?? "-").toLowerCase()}`,
    );
  }
  const missing = kws.filter(
    (k) => !rows.some((r) => r.keyword.toLowerCase() === k.toLowerCase()),
  );
  console.log(`\n${rows.length} keyword(s) · location ${loc} · ${lang}`);
  if (missing.length)
    console.log(`no data returned for: ${missing.join(", ")}`);
  await reportCost(res);
}

// Escape hatch for anything in the SKILL.md appendix that is not wired up yet.
// Costs whatever that endpoint costs. Unmeasured. Prints it afterwards.
async function raw(path: string, bodyJson: string | undefined, json: boolean) {
  let body: any;
  if (bodyJson) {
    try {
      body = JSON.parse(bodyJson);
    } catch (e) {
      console.error(`--- body is not valid JSON: ${(e as Error).message}`);
      process.exit(1);
    }
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  const res = await call(p, body);
  console.log(
    JSON.stringify(json ? res : (res.tasks?.[0]?.result ?? res), null, 2),
  );
  await reportCost(res);
}

// ---- dispatch ----

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const FLAGS = new Set(["location", "language", "json"]);

function flag(name: string, def: string): string {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}

// Positional args = everything that is not a flag and not a flag's value.
const args: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    if (FLAGS.has(a.slice(2)) && a !== "--json") i++; // skip the value
    continue;
  }
  args.push(a);
}

const cmd = args[0];
const loc = parseInt(flag("location", "2840"), 10);
const lang = flag("language", "en");

switch (cmd) {
  case "balance":
    await balance(json);
    break;
  case "traffic":
    if (args.length < 2) usage();
    await traffic(args.slice(1), loc, lang, json);
    break;
  case "keywords":
    if (args.length < 2) usage();
    await keywords(args.slice(1), loc, lang, json);
    break;
  case "raw":
    if (args.length < 2) usage();
    await raw(args[1], args[2], json);
    break;
  default:
    usage();
}

function usage(): never {
  console.error(
    [
      "usage:",
      "  dataforseo balance                              free, bare balance in USD",
      "  dataforseo traffic <domain> [domain...]         organic visits/mo + ranking keyword count",
      '  dataforseo keywords "<kw>" ["<kw>"...]          volume, difficulty, CPC, competition',
      "  dataforseo raw <endpoint-path> '<json body>'    any other endpoint (cost unmeasured)",
      "",
      "flags:",
      "  --json                  raw API response",
      "  --location <code>       default 2840 (US); 2246 FI, 2826 UK, 2276 DE",
      "  --language <code>       default en",
      "",
      "BATCH. Cost is per-task, not per-item, so pass every domain/keyword in one",
      "call. Never loop this script over a list. Check `balance` first; it's free.",
    ].join("\n"),
  );
  process.exit(1);
}
