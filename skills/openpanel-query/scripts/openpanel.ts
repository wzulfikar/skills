#!/usr/bin/env bun
// name: openpanel
// description: Read-only queries against OpenPanel cloud (Insights + Export APIs) — headline metrics, top pages, top referrers, and event counts (optionally broken down by a property like blog_slug)
// created: 2026-09-17
// workspace: none
//
// API: https://api.openpanel.dev  (docs: https://openpanel.dev/docs/api)
//   Metrics    GET /insights/{projectId}/metrics    -> visitors, sessions, bounce, etc for a range
//   Pages      GET /insights/{projectId}/pages       -> top pages by sessions
//   Referrers  GET /insights/{projectId}/referrer    -> top values of the "referrer" dimension (note: singular)
//   Events     GET /export/charts                    -> event counts over time, optional breakdown
//
// This is the read side only. Installing the tracker and wiring the write
// client into a Next/OpenNext/Cloudflare app is the sibling skill
// `openpanel-opennext-cloudflare`. That skill's client id/secret
// (OPENPANEL_CLIENT_ID/SECRET) are a *write* client and cannot be reused here.
//
// GOTCHA: OpenPanel's default project client is created in `write` mode and
// the Export/Insights APIs 401 for it — only a client created in `read` or
// `root` mode can call them. Create one in the OpenPanel dashboard
// (Settings -> API keys / clients) before this script will work.
//
// Auth: OPENPANEL_READ_CLIENT_ID / OPENPANEL_READ_CLIENT_SECRET (a read-or-root
// client, deliberately different names from the write-client env vars above),
// plus OPENPANEL_PROJECT_ID. Sent as `openpanel-client-id` /
// `openpanel-client-secret` headers.
//
// PER-PROJECT KEY. Different projects point at different OpenPanel instances,
// so the key has to come from wherever this script is run, not one shared
// account-wide file. Lookup order: ./.env.local, then ./.env, then ./.envrc
// (KEY=value or export KEY=value; quotes and trailing comments stripped),
// then process.env. The first source that has OPENPANEL_READ_CLIENT_ID wins,
// and ALL THREE vars must come from that one source — mixing a client id
// from one file with a project id from another would silently query the
// wrong instance. Which source was used is printed to stderr (stdout stays
// pipeable for --json). The key itself is never printed.
//
// UNVERIFIED: the exact query-param encoding `/export/charts` expects for the
// `series` / `breakdowns` array<object> params is not nailed down in the public
// docs (no worked example was found). This script JSON-encodes each as a
// single query-string value, e.g. series=[{"name":"page_view"}] — the common
// shape for a Zod-typed query schema. If OpenPanel rejects that shape, `events`
// prints the raw error; fall back to `raw` against `/export/charts` to explore,
// then fix this comment and the `events()` function together.
//
// Usage:
//   openpanel metrics                                headline numbers for the range
//   openpanel pages                                   top pages by views/sessions
//   openpanel referrers                               top referrers / sources
//   openpanel events <name> [name...] [--breakdown <property>]
//                                                      event counts, optionally by property
//   openpanel raw <path> '<json query params>'         escape hatch, GET only
//   flags: --json   --range <7d|30d|3m|6m|12m|today|yesterday|monthToDate|lastMonth|...>
//          --start YYYY-MM-DD --end YYYY-MM-DD (overrides --range)
//
// Always prints the date range it queried in human output — numbers without a
// range are not answers an analyst can use.

import { readFileSync } from "fs";

const BASE = "https://api.openpanel.dev";

// Per-project key: cwd files first (in this order), then process.env.
const PROJECT_FILES = ["./.env.local", "./.env", "./.envrc"];

function parseEnvFile(path: string): Record<string, string> | null {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const dq = rawValue.match(/^"([^"]*)"/);
    const sq = rawValue.match(/^'([^']*)'/);
    out[key] = dq ? dq[1] : sq ? sq[1] : rawValue.replace(/\s+#.*$/, "").trim();
  }
  return out;
}

const OPENPANEL_VARS = [
  "OPENPANEL_READ_CLIENT_ID",
  "OPENPANEL_READ_CLIENT_SECRET",
  "OPENPANEL_PROJECT_ID",
] as const;

// All three vars must come from the same source — mixing a client id from
// one file with a project id from another would silently query the wrong
// OpenPanel instance. The source is whichever place has the primary var
// (OPENPANEL_READ_CLIENT_ID); if that source is missing either of the other
// two, that's an error naming the source and what's missing, not a silent
// fallback to another source.
function loadCreds(): { clientId: string; clientSecret: string; projectId: string } {
  for (const file of PROJECT_FILES) {
    const parsed = parseEnvFile(file);
    if (!parsed || parsed[OPENPANEL_VARS[0]] === undefined) continue;
    const missing = OPENPANEL_VARS.filter((v) => parsed[v] === undefined);
    if (missing.length) {
      console.error(
        `${missing.join(", ")} not found in ${file} — it has OPENPANEL_READ_CLIENT_ID, ` +
          `so all three openpanel vars must come from there`,
      );
      process.exit(1);
    }
    console.error(`openpanel: keys from ${file}`);
    return {
      clientId: parsed[OPENPANEL_VARS[0]],
      clientSecret: parsed[OPENPANEL_VARS[1]],
      projectId: parsed[OPENPANEL_VARS[2]],
    };
  }
  if (process.env[OPENPANEL_VARS[0]] !== undefined) {
    const missing = OPENPANEL_VARS.filter((v) => process.env[v] === undefined);
    if (missing.length) {
      console.error(
        `${missing.join(", ")} not found in environment — OPENPANEL_READ_CLIENT_ID is set ` +
          `there, so all three openpanel vars must come from there`,
      );
      process.exit(1);
    }
    console.error("openpanel: keys from environment");
    return {
      clientId: process.env[OPENPANEL_VARS[0]]!,
      clientSecret: process.env[OPENPANEL_VARS[1]]!,
      projectId: process.env[OPENPANEL_VARS[2]]!,
    };
  }
  console.error(`${OPENPANEL_VARS[0]} not found in ./.env.local, ./.env, ./.envrc or environment`);
  process.exit(1);
}

let cachedCreds: { clientId: string; clientSecret: string; projectId: string } | null = null;

// Cached so the "keys from ..." stderr line prints once per run, not once
// per call() (headers() and each command both need creds()).
function creds() {
  if (!cachedCreds) cachedCreds = loadCreds();
  return cachedCreds;
}

function headers() {
  const { clientId, clientSecret } = creds();
  return {
    "openpanel-client-id": clientId,
    "openpanel-client-secret": clientSecret,
    Accept: "application/json",
  };
}

function query(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function call(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  const text = await res.text();
  if (!res.ok) {
    console.error(`openpanel HTTP ${res.status} on ${path}\n${text.slice(0, 800)}`);
    if (res.status === 401 || res.status === 403) {
      console.error(
        "check OPENPANEL_READ_CLIENT_ID/SECRET are a read-or-root client — " +
          "the default write client cannot call Export/Insights.",
      );
    }
    process.exit(1);
  }
  try {
    return JSON.parse(text);
  } catch {
    console.error(`openpanel returned non-JSON on ${path}\n${text.slice(0, 500)}`);
    process.exit(1);
  }
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

// ---- range handling ----

type RangeArgs = { params: Record<string, string>; label: string };

function rangeParams(startArg: string, endArg: string, rangeArg: string): RangeArgs {
  if (startArg && endArg) {
    return { params: { startDate: startArg, endDate: endArg }, label: `${startArg} to ${endArg}` };
  }
  return { params: { range: rangeArg }, label: rangeArg };
}

// ---- generic response shape handling ----
//
// Field names for /insights/*/pages and /insights/*/referrer are not fully
// documented (the public API reference lists an empty response body for
// both). Rather than hard-code a field name that might not match, pick the
// first string field from a known-candidate list and the first numeric field
// from another, and say so plainly when nothing matches.

function extractList(res: any): any[] {
  if (Array.isArray(res)) return res;
  for (const key of ["data", "items", "pages", "referrer", "referrers", "list", "result", "series"]) {
    if (Array.isArray(res?.[key])) return res[key];
  }
  return [];
}

function pickField(obj: any, candidates: string[]): [string, unknown] | null {
  for (const c of candidates) if (obj?.[c] !== undefined) return [c, obj[c]];
  return null;
}

function printTopTable(items: any[], labelKeys: string[], countKeys: string[]) {
  if (!items.length) {
    console.log("(no rows returned — response shape may not match what this script expects; try --json)");
    return;
  }
  const rows = items
    .map((it) => {
      const l = pickField(it, labelKeys);
      const c = pickField(it, countKeys);
      return {
        label: l ? String(l[1]) : JSON.stringify(it).slice(0, 40),
        count: c ? Number(c[1]) : null,
      };
    })
    .sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
  const w = Math.max(6, ...rows.map((r) => r.label.length));
  console.log(`${pad("value", w)}  ${padL("count", 8)}`);
  console.log(`${"-".repeat(w)}  ${"-".repeat(8)}`);
  for (const r of rows) {
    console.log(`${pad(r.label, w)}  ${padL(r.count == null ? "-" : fmt(r.count), 8)}`);
  }
  console.log(`\n${rows.length} row(s)`);
}

function fmtMetricValue(key: string, v: unknown): string {
  if (v == null) return "-";
  if (typeof v === "number") {
    if (/rate|percent/i.test(key)) return `${(v <= 1 ? v * 100 : v).toFixed(1)}%`;
    if (/duration|time/i.test(key)) return `${v.toFixed(1)}s`;
    return fmt(v, 2);
  }
  return String(v);
}

function printKeyValueTable(obj: Record<string, unknown>) {
  const entries = Object.entries(obj ?? {}).filter(([, v]) => typeof v !== "object" || v === null);
  if (!entries.length) {
    console.log("(empty response body — try --json)");
    return;
  }
  const w = Math.max(6, ...entries.map(([k]) => k.length));
  for (const [k, v] of entries) console.log(`${pad(k, w)}  ${fmtMetricValue(k, v)}`);
}

// ---- commands ----

async function metrics(range: RangeArgs, json: boolean) {
  const { projectId } = creds();
  const res = await call(`/insights/${projectId}/metrics${query(range.params)}`);
  if (json) return console.log(JSON.stringify(res, null, 2));
  console.log(`range: ${range.label}\n`);
  // Field names here are documented loosely ("visitors, sessions, bounce
  // rate, engagement"), so print whatever the API actually returns instead
  // of mapping to named fields that might not exist.
  printKeyValueTable(res.data ?? res);
}

async function pages(range: RangeArgs, limit: number, json: boolean) {
  const { projectId } = creds();
  const res = await call(`/insights/${projectId}/pages${query({ ...range.params, limit: String(limit) })}`);
  if (json) return console.log(JSON.stringify(res, null, 2));
  console.log(`range: ${range.label}\n`);
  printTopTable(extractList(res), ["path", "page", "pathname", "url"], ["sessions", "count", "visits", "views"]);
}

async function referrers(range: RangeArgs, limit: number, json: boolean) {
  const { projectId } = creds();
  const res = await call(`/insights/${projectId}/referrer${query({ ...range.params, limit: String(limit) })}`);
  if (json) return console.log(JSON.stringify(res, null, 2));
  console.log(`range: ${range.label}\n`);
  printTopTable(extractList(res), ["referrer", "source", "name", "utm_source"], ["sessions", "count", "visits"]);
}

// series/breakdowns encoding is a best-effort guess — see the UNVERIFIED note
// at the top of this file.
async function events(names: string[], breakdown: string | undefined, range: RangeArgs, json: boolean) {
  const { projectId } = creds();
  const series = JSON.stringify(names.map((name) => ({ name })));
  const q: Record<string, string> = { ...range.params, projectId, series };
  if (breakdown) q.breakdowns = JSON.stringify([{ name: breakdown }]);
  const res = await call(`/export/charts${query(q)}`);
  if (json) return console.log(JSON.stringify(res, null, 2));
  console.log(
    `range: ${range.label}  ·  event(s): ${names.join(", ")}` +
      (breakdown ? `  ·  breakdown: ${breakdown}` : ""),
  );
  const data = extractList(res);
  if (!data.length) {
    console.log("\n(unexpected shape from /export/charts — printing the raw response)\n");
    console.log(JSON.stringify(res, null, 2));
    console.log(
      "\nthe series/breakdowns query-param encoding is unverified against a live " +
        "read-mode client — see the UNVERIFIED comment in this script.",
    );
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

// Escape hatch. GET only — this API has no writes worth exposing here anyway.
async function raw(path: string, paramsJson: string | undefined, json: boolean) {
  let params: Record<string, any> = {};
  if (paramsJson) {
    try {
      params = JSON.parse(paramsJson);
    } catch (e) {
      console.error(`params is not valid JSON: ${(e as Error).message}`);
      process.exit(1);
    }
  }
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) q[k] = typeof v === "string" ? v : JSON.stringify(v);
  const p = path.startsWith("/") ? path : `/${path}`;
  const res = await call(`${p}${query(q)}`);
  console.log(JSON.stringify(json ? res : (res.data ?? res), null, 2));
}

// ---- dispatch ----

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const FLAGS = new Set(["range", "start", "end", "breakdown", "limit", "json"]);

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
const range = rangeParams(flag("start", ""), flag("end", ""), flag("range", "30d"));
const limit = parseInt(flag("limit", "20"), 10);
const breakdown = argv.includes("--breakdown") ? flag("breakdown", "") : undefined;

switch (cmd) {
  case "metrics":
    await metrics(range, json);
    break;
  case "pages":
    await pages(range, limit, json);
    break;
  case "referrers":
    await referrers(range, limit, json);
    break;
  case "events":
    if (args.length < 2) usage();
    await events(args.slice(1), breakdown, range, json);
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
      "  openpanel metrics                               visitors, sessions, bounce, duration for the range",
      "  openpanel pages                                  top pages by views/sessions",
      "  openpanel referrers                              top referrers / sources",
      "  openpanel events <name> [name...] [--breakdown <property>]",
      "                                                    event counts, optionally split by a property",
      "  openpanel raw <path> '<json query params>'       GET only, any other endpoint",
      "",
      "flags:",
      "  --json                    raw API response",
      "  --range <7d|30d|3m|6m|12m|today|yesterday|monthToDate|lastMonth|...>  default 30d",
      "  --start YYYY-MM-DD --end YYYY-MM-DD              custom range, overrides --range",
      "  --breakdown <property>                           events only, e.g. blog_slug, utm_campaign",
      "  --limit <n>                                       pages/referrers only, default 20",
      "",
      "Needs a client created in OpenPanel with read or root access — the",
      "default project client is write-only and will 401 here.",
    ].join("\n"),
  );
  process.exit(1);
}
