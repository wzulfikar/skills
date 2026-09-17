#!/usr/bin/env bun
// name: autumn
// description: Read-only queries against Autumn billing (api.useautumn.com) — customer list, one customer's subscriptions and feature balances, and active-customers-per-plan
// created: 2026-09-17
// workspace: none
//
// API: https://api.useautumn.com  (docs: https://docs.useautumn.com/api-reference)
//   List customers   POST /v1/customers.list   -> cursor-paginated, {list, next_cursor}
//   Get customer     POST /v1/customers.get    -> subscriptions[] + balances{} for one id
//
// READ-ONLY, ON PURPOSE. AUTUMN_SECRET_KEY can create/cancel subscriptions and
// change feature balances — real billing, real money. This script never calls
// a mutating endpoint, and `raw` refuses anything that isn't one of Autumn's
// ".get" / ".list" actions (see assertReadOnly below). If a job needs a write,
// it does not belong in this script.
//
// Auth: AUTUMN_SECRET_KEY as `Authorization: Bearer $AUTUMN_SECRET_KEY`, plus
// `x-api-version: 2.3.0` (the version the /v1/customers.get and
// /v1/customers.list docs are written against).
//
// PER-PROJECT KEY. Different projects bill through different Autumn
// instances, so the key has to come from wherever this script is run, not
// one shared account-wide file. Lookup order: ./.env.local, then ./.env,
// then ./.envrc (KEY=value or export KEY=value; quotes and trailing comments
// stripped), then process.env. Which source was used is printed to stderr
// (stdout stays pipeable for --json). The key itself is never printed.
//
// Response field casing is inconsistent across Autumn's own docs — the
// abstract schema pages use snake_case (created_at, plan_id), the actual
// example payloads use camelCase (createdAt, planId). This script reads both
// via `pick()` and prefers whichever is actually present.
//
// Usage:
//   autumn customers [--plan <id>] [--since YYYY-MM-DD] [--limit N]
//                                                table of customers, newest first (default limit 200)
//   autumn customer <id>                        subscriptions + feature balances for one customer
//   autumn plans                                active customer count per plan, built from the customer list
//   autumn raw <path> '<json body>'             escape hatch, .get/.list actions only
//   flags: --json

import { readFileSync } from "fs";

const BASE = "https://api.useautumn.com";
const API_VERSION = "2.3.0";

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

function loadSecretKey(): string {
  for (const file of PROJECT_FILES) {
    const parsed = parseEnvFile(file);
    if (!parsed || parsed.AUTUMN_SECRET_KEY === undefined) continue;
    console.error(`autumn: keys from ${file}`);
    return parsed.AUTUMN_SECRET_KEY;
  }
  if (process.env.AUTUMN_SECRET_KEY !== undefined) {
    console.error("autumn: keys from environment");
    return process.env.AUTUMN_SECRET_KEY;
  }
  console.error("AUTUMN_SECRET_KEY not found in ./.env.local, ./.env, ./.envrc or environment");
  process.exit(1);
}

let cachedSecretKey: string | null = null;

// Cached so the "keys from ..." stderr line prints once per run, not once
// per call() (headers() is called on every request).
function secretKey(): string {
  if (cachedSecretKey === null) cachedSecretKey = loadSecretKey();
  return cachedSecretKey;
}

function headers() {
  return {
    Authorization: `Bearer ${secretKey()}`,
    "x-api-version": API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function call(path: string, body: any = {}): Promise<any> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${BASE}${p}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`autumn HTTP ${res.status} on ${p}\n${text.slice(0, 800)}`);
    process.exit(1);
  }
  try {
    return JSON.parse(text);
  } catch {
    console.error(`autumn returned non-JSON on ${p}\n${text.slice(0, 500)}`);
    process.exit(1);
  }
}

// Allowlist, not denylist: refuse everything except Autumn's own ".get" /
// ".list" action suffix (its RPC convention is <resource>.<action>, e.g.
// customers.list, customers.get, plans.list). Anything else — .create,
// .update, .cancel, .attach, .checkout, .track, .expire, ... — can change
// real billing, so raw will not attempt it even if it looks harmless.
function assertReadOnly(path: string) {
  const clean = path.split("?")[0].replace(/^\/+/, "");
  const last = clean.split("/").pop() ?? "";
  const action = last.includes(".") ? last.split(".").pop() : "";
  if (action !== "get" && action !== "list") {
    console.error(
      [
        `refusing "${path}".`,
        `raw only allows Autumn's ".get" / ".list" read actions — this key can`,
        `change real billing (subscriptions, balances, invoices, plans) on every`,
        `other action, so raw will not attempt one. Use "customers", "customer <id>"`,
        `or "plans" for the read paths already wired up.`,
      ].join("\n"),
    );
    process.exit(1);
  }
}

// Some fields are snake_case in Autumn's schema docs and camelCase in its
// example payloads. Take whichever is actually present.
function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) if (obj?.[k] !== undefined) return obj[k];
  return undefined;
}

function fmtDate(ms: number | undefined): string {
  if (!ms) return "-";
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function activePlans(customer: any): string {
  const subs = pick(customer, "subscriptions") ?? [];
  const ids = subs
    .filter((s: any) => pick(s, "status") === "active")
    .map((s: any) => pick(s, "planId", "plan_id"))
    .filter(Boolean);
  return ids.length ? ids.join(", ") : "-";
}

// One paginated fetch, following next_cursor until `limit` customers are
// collected or the API runs out of pages.
async function listAllCustomers(opts: { plan?: string; since?: string; limit: number }): Promise<any[]> {
  const out: any[] = [];
  let cursor = "";
  const pageSize = 100;
  while (out.length < opts.limit) {
    const body: any = {
      start_cursor: cursor,
      limit: Math.min(pageSize, opts.limit - out.length),
      sort_order: "desc",
    };
    if (opts.plan) body.plans = [{ id: opts.plan }];
    if (opts.since) {
      const lower = Date.parse(opts.since);
      if (!Number.isNaN(lower)) body.created_at_range = { lower };
    }
    const res = await call("/v1/customers.list", body);
    const page = pick(res, "list") ?? [];
    out.push(...page);
    const next = pick(res, "next_cursor", "start_cursor");
    if (!next || page.length === 0) break;
    cursor = next;
  }
  return out.slice(0, opts.limit);
}

// ---- commands ----

async function customers(opts: { plan?: string; since?: string; limit: number }, json: boolean) {
  const list = await listAllCustomers(opts);
  if (json) return console.log(JSON.stringify(list, null, 2));
  const rows = list.map((c) => ({
    id: String(pick(c, "id") ?? "-"),
    email: String(pick(c, "email") ?? "-"),
    created: fmtDate(pick(c, "createdAt", "created_at")),
    plans: activePlans(c),
  }));
  if (!rows.length) {
    console.log("(no customers matched)");
    return;
  }
  const wId = Math.max(2, ...rows.map((r) => r.id.length));
  const wEmail = Math.max(5, ...rows.map((r) => r.email.length));
  console.log(`${pad("id", wId)}  ${pad("email", wEmail)}  created     plans`);
  console.log(`${"-".repeat(wId)}  ${"-".repeat(wEmail)}  ----------  -----`);
  for (const r of rows) {
    console.log(`${pad(r.id, wId)}  ${pad(r.email, wEmail)}  ${r.created}  ${r.plans}`);
  }
  console.log(`\n${rows.length} customer(s)`);
}

async function customer(id: string, json: boolean) {
  const c = await call("/v1/customers.get", { customer_id: id });
  if (json) return console.log(JSON.stringify(c, null, 2));
  console.log(
    `${pick(c, "id") ?? id}  ${pick(c, "email") ?? "-"}  created ${fmtDate(pick(c, "createdAt", "created_at"))}`,
  );

  console.log("\nsubscriptions:");
  const subs = pick(c, "subscriptions") ?? [];
  if (!subs.length) console.log("  (none)");
  for (const s of subs) {
    console.log(
      `  ${pick(s, "planId", "plan_id")}  ${pick(s, "status")}` +
        `  started ${fmtDate(pick(s, "startedAt", "started_at"))}` +
        `  trial-ends ${fmtDate(pick(s, "trialEndsAt", "trial_ends_at"))}` +
        `  canceled ${fmtDate(pick(s, "canceledAt", "canceled_at"))}`,
    );
  }

  console.log("\nfeature balances:");
  const balances = pick(c, "balances") ?? {};
  const entries = Object.entries(balances);
  if (!entries.length) console.log("  (none)");
  for (const [key, b] of entries as [string, any][]) {
    const feature = pick(b, "featureId", "feature_id") ?? key;
    console.log(
      `  ${feature}  granted ${pick(b, "granted") ?? "-"}` +
        `  usage ${pick(b, "usage") ?? "-"}` +
        `  remaining ${pick(b, "remaining") ?? "-"}`,
    );
  }
}

async function plans(json: boolean, limit: number) {
  const list = await listAllCustomers({ limit });
  const counts = new Map<string, number>();
  for (const c of list) {
    const subs = pick(c, "subscriptions") ?? [];
    for (const s of subs) {
      if (pick(s, "status") !== "active") continue;
      const id = pick(s, "planId", "plan_id") ?? "unknown";
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (json) return console.log(JSON.stringify(Object.fromEntries(rows), null, 2));
  if (!rows.length) {
    console.log(`(no active subscriptions among ${list.length} customer(s) fetched)`);
    return;
  }
  const w = Math.max(4, ...rows.map(([p]) => p.length));
  console.log(`${pad("plan", w)}  active customers`);
  console.log(`${"-".repeat(w)}  -----------------`);
  for (const [p, n] of rows) console.log(`${pad(p, w)}  ${n}`);
  console.log(`\nfrom ${list.length} customer(s) fetched (limit ${limit})`);
}

async function raw(path: string, bodyJson: string | undefined, json: boolean) {
  assertReadOnly(path);
  let body: any = {};
  if (bodyJson) {
    try {
      body = JSON.parse(bodyJson);
    } catch (e) {
      console.error(`body is not valid JSON: ${(e as Error).message}`);
      process.exit(1);
    }
  }
  const res = await call(path, body);
  console.log(JSON.stringify(res, null, 2));
}

// ---- dispatch ----

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const FLAGS = new Set(["plan", "since", "limit", "json"]);

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
const limit = parseInt(flag("limit", "200"), 10);
const plan = argv.includes("--plan") ? flag("plan", "") : undefined;
const since = argv.includes("--since") ? flag("since", "") : undefined;

switch (cmd) {
  case "customers":
    await customers({ plan, since, limit }, json);
    break;
  case "customer":
    if (args.length < 2) usage();
    await customer(args[1], json);
    break;
  case "plans":
    await plans(json, limit);
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
      "  autumn customers [--plan <id>] [--since YYYY-MM-DD] [--limit N]",
      "                                            table: id, email, created, active plan(s) — newest first",
      "  autumn customer <id>                       subscriptions + feature balances for one customer",
      "  autumn plans                               active customer count per plan",
      "  autumn raw <path> '<json body>'            .get/.list actions only — everything else is refused",
      "",
      "flags:",
      "  --json                raw API response",
      "  --plan <id>           customers, filter to one plan",
      "  --since YYYY-MM-DD    customers, only created on/after this date",
      "  --limit <n>           customers/plans, default 200",
      "",
      "READ-ONLY. AUTUMN_SECRET_KEY can change real billing; this script never",
      "calls a mutating endpoint, and raw refuses anything that isn't a",
      "documented .get/.list action.",
    ].join("\n"),
  );
  process.exit(1);
}
