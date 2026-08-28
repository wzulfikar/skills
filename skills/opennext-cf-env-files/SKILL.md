---
name: opennext-safe-env
description: Set up typed, validated environment variables for a Next.js app deployed to Cloudflare Workers via OpenNext — three files (env.ts, env.client.ts, env.server.ts) at the import-alias root, with client vars validated at build time and server vars validated in the worker, plus a check-env-vars script for CI. Use for "set up env vars for opennext", "env validation on cloudflare", "my NEXT_PUBLIC var is undefined in production", "where do I put secrets for a Cloudflare Worker Next app", "add an env var to this app".
---

# OpenNext safe env

Next.js on Cloudflare has two disconnected environments — the build container
and the worker — and Workers, unlike Pages, does **not** share variables between
them. Guess wrong about which side a variable lives on and it is `undefined` in
production with no error. This scaffolds three files that make that split
explicit and fail loudly on the correct side.

```
env.ts          isomorphic helpers + the parseEnv checker
env.client.ts   NEXT_PUBLIC_* only. Validated at BUILD time.
env.server.ts   vars + secrets.      Validated in the WORKER at runtime.
```

Call sites stay flat: `import { env } from "@/env.server"`.

## The rule this encodes

| | Cloudflare build vars | wrangler `vars` + secrets (runtime) |
|---|---|---|
| `NEXT_PUBLIC_*` | inlined into the bundle ✅ | **ignored** — value already baked in |
| server var / secret | only reaches code that runs *during* the build (SSG, `generateStaticParams`, `generateMetadata`) | the real source ✅ |

Next statically replaces `process.env.NEXT_PUBLIC_X` at build. That is the only
moment a public var can be set, so setting one as a runtime var does nothing.

Non-public vars are **not** inlined (OpenNext targets the nodejs runtime, not
edge), so they stay a live `process.env` lookup in the worker — and a secret
handed to the build is not baked into the artifact. Build vars are useless at
runtime, not dangerous.

## Where the files go

The app root — the directory holding `next.config.*` — *unless* the import alias
points somewhere else. Check first:

```bash
grep -A5 '"paths"' tsconfig.json
```

- `"@/*": ["./src/*"]` → put the files in `src/`
- `"@/*": ["./*"]` (or bare `baseUrl`) → put them at the app root

Goal is `@/env.server` with no subpath. If there is no alias, relative imports
work fine; skip the alias step.

In a monorepo this is the Next app's root, not the repo root.

## Install

1. Copy `templates/env.ts`, `env.client.ts`, `env.server.ts` to that directory.
2. Add the script from `templates/package-json.md`, fixing the path (`./src/…`
   vs `./…`) to match step 1.
3. Set `NEXT_PUBLIC_IS_CF_BUILD=1` as a **build** variable in the Cloudflare
   dashboard (Workers Builds → Build variables and secrets). Without it, client
   validation never runs.
4. Confirm the worker can read `process.env` at all: `compatibility_date` >=
   `2025-04-01` with `nodejs_compat`, or add
   `nodejs_compat_populate_process_env` explicitly.

```jsonc
// wrangler.jsonc
{
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "vars": { "APP_URL": "https://example.com" }
}
```

## Adding a variable

```
NEXT_PUBLIC_ prefix?  ──yes──▶  env.client.ts  +  Cloudflare BUILD var
                      ──no───▶  env.server.ts  +  wrangler vars / secret
                                                  (+ build var too, only if
                                                   SSG reads it at build)

App broken without it? ──yes──▶ requiredEnv   (throws when missing)
                       ──no───▶ optionalEnv   (typed `| undefined`)
```

Write the access as a literal member expression — `process.env.NEXT_PUBLIC_FOO`.
Dynamic lookups like `process.env[key]` are invisible to Next's static
replacement and come back `undefined` in the browser.

Non-secret runtime values belong in `wrangler.jsonc` `vars`; real secrets go
through `wrangler secret put` or the dashboard. `wrangler deploy` **overwrites
dashboard-set vars** unless `keep_vars` is on — secrets are never deleted — so
config-file vars are the durable choice.

## Where each check fires

| | gate | fires |
|---|---|---|
| `env.client.ts` | `IS_CF_BUILD` | Cloudflare build — the last chance to set a public var |
| `env.server.ts` | `IS_CF_WORKER` | in the worker, on cold start of the module |
| `check-env-vars` | both forced to `1` | locally / in CI, before deploying |

`IS_CF_WORKER` detects workerd by `navigator.userAgent === "Cloudflare-Workers"`
rather than a configured variable, so it cannot be silently switched off by a
deploy that rewrites vars. The `IS_CF_WORKER=1` env override exists for the
check script, which runs under Bun.

`check-env-vars` validates against *the shell it runs in* — it proves the
manifest is satisfiable, not that Cloudflare has the values. To make it a real
deploy gate, run it in CI with the same variables the build and worker will see.

## Gotchas

- **`NEXT_PUBLIC_*` set as a runtime var.** Silently `undefined` in the browser.
  Move it to build vars and redeploy — editing a build var requires a rebuild,
  not just a restart.
- **Server var missing at build.** Only a problem if SSG touches it. The server
  check is gated on the worker, so a runtime-only secret will not fail a build.
- **`env.server` imported from a client component.** Values resolve to
  `undefined` and the module ends up in the client graph. Add
  `import "server-only"` at the top of `env.server.ts` to turn that into a build
  error (needs the `server-only` package).
- **Old `compatibility_date`.** Without `nodejs_compat_populate_process_env`,
  `process.env` is `{}` in the worker: every value `undefined` *and* the check
  passes, because the gate reads empty too. Fail-open — pin the date.
- **Dashboard vars vanishing after `wrangler deploy`.** Expected; declare them
  in the config file.

## Verify

```bash
bun run check-env-vars          # manifest satisfiable
```

Then on a preview deployment, confirm a required server var is actually read in
the worker — remove one and hit a route that uses it. It must throw
`[worker error] [env.server.ts] Missing environment variables: …`, not return
`undefined`.
