/**
 * PUBLIC analytics config — safe to inline into a browser bundle.
 *
 * The client secret deliberately lives in ./server/config so nothing a browser
 * can reach ever references it. Keep that split.
 *
 * Dependency-free on purpose. `worker.js` reaches this file (through
 * ./server/op-proxy) and is bundled by Wrangler, not Next — the `@/` and
 * `@shared/` tsconfig aliases are not reliably in play there. Read
 * `process.env.NEXT_PUBLIC_*` as a literal member expression instead of routing
 * through a typed env module; Next substitutes it at build time either way.
 */

/** The hosted API. Overridden by `OPENPANEL_API_URL` when self-hosting. */
export const OPENPANEL_DEFAULT_API_URL = "https://api.openpanel.dev"

/**
 * Path the browser client posts to. Relative, so requests hit our own origin
 * instead of `api.openpanel.dev` and survive ad blockers — which otherwise
 * silently shrink the numbers. Served by `worker.js` in production and by the
 * catch-all route at `src/app/api/op/[...all]/route.ts` under `next dev`; both
 * forward `/api/op/track` on to the real API via `./server/op-proxy.ts`.
 */
export const OPENPANEL_PROXY_PATH = "/api/op"

export const openpanelClientConfig = {
  /**
   * Inlined at BUILD time by Next. A Cloudflare Worker `vars` entry can never
   * reach it — the id has to be in the build environment (a Workers Builds
   * build variable, or `.env` locally). Empty in dev/preview without one, which
   * the `filter` in ./client/index.ts turns into a silent no-op.
   */
  clientId: process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID ?? "",
  apiUrl: OPENPANEL_PROXY_PATH,
}
