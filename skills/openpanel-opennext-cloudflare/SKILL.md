---
name: openpanel-opennext-cloudflare
description: Wire OpenPanel analytics into a Next.js app deployed to Cloudflare Workers via OpenNext — browser client behind a first-party Worker proxy (so ad blockers don't eat the numbers), server-side tracking with the client secret, and the build-var vs runtime-secret split Cloudflare forces on you. Use for "add OpenPanel to my Next app", "analytics on opennext/cloudflare", "OpenPanel 401 Invalid cors or secret", "my analytics events aren't showing up on Cloudflare", "proxy analytics through my own domain".
---

# OpenPanel on OpenNext + Cloudflare

Three things make this more than `npm install`:

1. **Ad blockers block `api.openpanel.dev` by name.** Beacons have to leave from
   your own origin, which means a proxy — and on Workers the cheapest place for
   that proxy is `worker.js`, before OpenNext's pipeline runs at all.
2. **Cloudflare splits build and runtime env, and Workers does not share them.**
   The client id is a *build* variable (Next inlines `NEXT_PUBLIC_*` while
   bundling); the client secret is a *runtime* secret. Swap them and you get
   zero events and no error.
3. **The Worker is frozen the moment it returns a response.** Fire-and-forget
   server-side tracking is killed mid-flight. Every server call is `await`ed.

## Shape

```
src/analytics/
  config.ts               PUBLIC config — client id, proxy path. Dep-free.
  events.ts               event-name catalog. Dep-free.
  types.ts                RequestContext. Dep-free.
  client/
    index.ts              'use client' browser singleton (@openpanel/web)
    AnalyticsProvider.tsx one screen_view per App Router navigation
  server/
    index.ts              server-side track / identify / revenue (@openpanel/sdk)
    config.ts             server-only env — the client secret. Never client-imported.
    context.ts            ip / user-agent off an incoming Request
    op-proxy.ts           the proxy handler, shared by worker.js and the route
    log.ts                dev tracing
worker.js                 intercepts /api/op/* before OpenNext
src/app/api/op/[...all]/route.ts   same handler, for `next dev`
```

Two entry points, one implementation. `worker.js` serves the proxy in
production; the catch-all route serves it under `next dev`, which never executes
`worker.js`. Both call `handleOpProxy`.

### Why not `@openpanel/nextjs`

It ships `createRouteHandler()`, which does the proxying in three lines. It runs
*inside* Next, so every beacon pays for OpenNext's routing, middleware and
server-runtime init on a cold isolate — billed CPU on the highest-volume path on
the site. Take it if you don't have a custom `worker.js` and don't want one; the
env split, the CORS setup and the frozen-Worker rule below still all apply.

## Install

1. `bun add @openpanel/web @openpanel/sdk` (or npm/pnpm).

2. Copy `templates/analytics/` into the app. Anywhere the import alias reaches —
   `src/analytics/` if `"@/*": ["./src/*"]`. Fix the import in
   `templates/route.ts` to match.

3. Copy `templates/route.ts` → `src/app/api/op/[...all]/route.ts`.

4. Wire the Worker — see `templates/worker.md`. This is the step that differs
   most per repo (existing `worker.js`, Durable Object re-exports, other
   wrappers).

5. Set env — see `templates/env.md`. Client id as a **build** variable, client
   secret via `wrangler secret put`.

6. Add the CORS origin in the OpenPanel dashboard (project → client → CORS).

7. Mount the provider in the root layout:

   ```tsx
   import { AnalyticsProvider } from "@/analytics/client/AnalyticsProvider"
   // …
   <body>
     {children}
     <AnalyticsProvider />
   </body>
   ```

8. Replace the placeholder events in `analytics/events.ts` with real ones.

## Using it

```tsx
// client component
"use client"
import { analytics, EVENTS } from "@/analytics/client"

<button onClick={() => analytics.track(EVENTS.OPEN_PAYWALL, { plan: "pro" })}>

// or declaratively — trackAttributes is on
<button data-track="open_paywall">
```

```ts
// route handler / webhook / cron — server side
import { track, revenue, getRequestContext } from "@/analytics/server"

export async function POST(request: Request) {
  const ctx = getRequestContext(request)          // ip + user agent
  await track({ event: EVENTS.SIGNUP, profileId: userId, ...ctx })
  //  ^^^^^ never `void` this — see below
}
```

`getRequestContext` is not optional decoration. Server events leave *your*
infrastructure, so without an explicit IP and user agent OpenPanel geo-attributes
every one of them to the Cloudflare colo.

## The env split

| | Cloudflare build vars | wrangler `vars` + secrets (runtime) |
|---|---|---|
| `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` | inlined into the bundle ✅ | **ignored** — value already baked in |
| `OPENPANEL_CLIENT_SECRET` | useless | the real source ✅ |

`server/config.ts` reads the **public** name server side on purpose: Next
substitutes `NEXT_PUBLIC_*` across both bundles at build time, so it resolves to
a literal there. An unprefixed `OPENPANEL_CLIENT_ID` would only be readable from
`worker.js`, which never needs it — the proxy forwards the browser's own
`openpanel-client-id` header.

The one bundle Next does **not** compile is `worker.js`. Wrangler bundles that
with esbuild, so nothing reachable from `op-proxy.ts` may use a `@/` alias or a
typed env module. Both config files read `process.env` directly for this reason.
Keep them that way.

## Gotchas

- **`401 Ingestion: Invalid cors or secret`.** The origin isn't on the client's
  CORS allowlist. The proxy strips the browser's `Origin` and re-attaches it for
  exactly this check. Add the origin in the dashboard — and note the proxy also
  sends the client secret when configured, which authorises regardless of
  origin and is what keeps localhost and preview branches working.

- **Zero events, no error, `clientId: ""` in the bundle.** The client id was set
  as a runtime var. Move it to build variables and **rebuild** — restarting the
  worker won't do it.

- **Server events vanish under load.** Something is `void`-ing an analytics call.
  The Worker is frozen at response time; `await` it, or hand it to
  `ctx.waitUntil()` via `getCloudflareContext()` from `@opennextjs/cloudflare`.
  A single fire-and-forget request usually lands; one chained behind another
  round trip usually does not.

- **Double `screen_view` per navigation.** The SDK's `trackScreenViews` patches
  `history.pushState` and double-fires under the App Router. It's off in the
  template; `AnalyticsProvider` fires them manually, guarded by a ref.

- **Client secret in `wrangler.jsonc` `vars`.** That file is committed. Use
  `wrangler secret put`.

- **Proxy works in `next dev`, 404s deployed.** `worker.js` isn't wired —
  `wrangler.jsonc` still points `main` at `.open-next/worker.js`.

- **Dev noise eating the event quota.** In OpenPanel a pageview *is* an event.
  Use a separate project for dev/preview; the client `filter` already drops
  everything when no client id is set, and under test.

- **`api.openpanel.dev` still in the network tab.** `apiUrl` didn't reach the
  constructor. It must be the relative `OPENPANEL_PROXY_PATH`, not a full URL.

## Verify

```sh
bunx wrangler dev        # the only local runtime that executes worker.js
```

1. Load a page. Network tab: a `POST /api/op/track` to **your** origin, `202`.
   No request to `api.openpanel.dev`.
2. Server logs show the proxy line — this is the one place browser beacons pass
   through your own logs:
   ```
   [analytics] web track screen_view /pricing ip=198.51.100.7
   ```
3. Hit a route that tracks server-side. Both lines must appear; the second is the
   confirmation it reached the API:
   ```
   [analytics] event signup {"plan":"pro"} → openpanel
   [analytics] openpanel track signup ok
   ```
   `→ NOT CONFIGURED — dropping` means the secret is missing.
4. OpenPanel dashboard → Realtime. Check the **country** on an event: if it's
   wherever your colo is rather than yours, IP forwarding is broken.
5. After deploying, repeat 1–2 against the real domain with an ad blocker
   enabled. That is the whole point of the proxy, and the only test that proves
   it.
