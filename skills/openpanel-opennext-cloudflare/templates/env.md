# Env

Two variables, on two different sides of Cloudflare's build/runtime split.
Getting the side wrong is silent — no error, just zero events.

| Var | Where | How |
| --- | --- | --- |
| `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` | **build** | `.env` locally; Workers Builds → *Build variables* in prod |
| `OPENPANEL_CLIENT_SECRET` | **runtime** | `wrangler secret put OPENPANEL_CLIENT_SECRET`, or dashboard → Settings → Variables → *Secret* |
| `OPENPANEL_API_URL` | both | Optional; only when self-hosting |
| `ANALYTICS_DEBUG` | runtime | Optional; `true` forces dev tracing on in production |

`.env` (local dev, and the build):

```sh
# OpenPanel. NEXT_PUBLIC_ is inlined by Next at BUILD time, so it must be here —
# a wrangler `vars` entry is runtime-only and reaches it too late.
NEXT_PUBLIC_OPENPANEL_CLIENT_ID=your-client-id
# Server-only. Never a wrangler `vars` entry — that file is world-readable.
OPENPANEL_CLIENT_SECRET=your-client-secret
# Only when self-hosting. Defaults to https://api.openpanel.dev
# OPENPANEL_API_URL=https://openpanel.example.com
```

`.dev.vars` (what `wrangler dev` reads as runtime env — `.env` does not reach it):

```sh
OPENPANEL_CLIENT_SECRET=your-client-secret
```

## Setting them

```sh
# runtime secret — prod
bunx wrangler secret put OPENPANEL_CLIENT_SECRET

# build var — no CLI for this; Cloudflare dashboard only:
#   Workers & Pages → <worker> → Settings → Build → Build variables and secrets
# Editing it requires a REBUILD, not just a restart.
```

## Using a typed env module

If the app validates env through `env.client.ts` / `env.server.ts` (see the
`opennext-cf-env-files` skill), register both names there so a missing one fails
loudly — but leave `analytics/config.ts` and `analytics/server/config.ts` reading
`process.env` directly. Those two files are reachable from `worker.js`, which
Wrangler bundles without the tsconfig aliases.

## Dashboard side

In OpenPanel: project → client → **CORS**, add the site's origin
(`https://example.com`, plus `http://localhost:3000` for dev). Browser events
carry no secret, so without it the API answers
`401 Ingestion: Invalid cors or secret`.

The proxy also forwards the client secret when configured, which authorises
regardless of origin — that is the belt to CORS's braces, and what keeps preview
branches and domain changes working.

**Use a separate OpenPanel project for dev/preview**, or local noise eats the
event quota.
