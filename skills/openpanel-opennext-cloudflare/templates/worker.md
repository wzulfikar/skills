# Worker integration

`worker.js` is a custom entry that wraps OpenNext's handler. It exists so
`/api/op/*` is answered before OpenNext's request pipeline runs — beacons are the
highest-volume path on the site (one per pageview plus one per event) and the
proxy is a pass-through `fetch` that needs nothing from Next. Skipping routing,
middleware and server-runtime init on a cold isolate is billed CPU time saved.

## If there is no `worker.js` yet

Create it next to `wrangler.jsonc`:

```js
import openNextHandler from "./.open-next/worker.js"
import { OPENPANEL_PROXY_PATH, handleOpProxy } from "./src/analytics/server/op-proxy.ts"

const OP_PREFIX = `${OPENPANEL_PROXY_PATH}/`

function fetch(request, env, ctx) {
  const { pathname } = new URL(request.url)
  if (pathname.startsWith(OP_PREFIX) && (request.method === "POST" || request.method === "GET")) {
    return handleOpProxy(request, pathname.slice(OP_PREFIX.length).split("/"))
  }
  return openNextHandler.fetch(request, env, ctx)
}

export default { ...openNextHandler, fetch }
```

Then point Wrangler at it:

```jsonc
// wrangler.jsonc
{ "main": "worker.js" }   // was ".open-next/worker.js"
```

Re-export any Durable Objects the app declares — `export { Foo } from "./src/..."` —
or the deploy fails on a missing class.

## If `worker.js` already exists

Add the prefix check as the **first** thing in the existing `fetch`, before any
other wrapper (crawler tracking, middleware, rate limiting). The whole point is
to not run them for a beacon.

## Notes

- The import path is relative and ends in `.ts` — Wrangler bundles this file with
  esbuild, not Next, so tsconfig `@/` aliases are not reliably in play here.
  Everything reachable from `op-proxy.ts` must therefore stay alias-free too.
- `next dev` never executes `worker.js`. The catch-all route in `route.ts` is
  what serves the same path locally; both call the same handler.
- `wrangler dev` does execute it, which is the only local way to test this path.
