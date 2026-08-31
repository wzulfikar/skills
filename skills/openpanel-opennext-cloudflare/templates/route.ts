/**
 * Copy to `src/app/api/op/[...all]/route.ts` (match OPENPANEL_PROXY_PATH).
 *
 * `next dev` fallback for the OpenPanel proxy.
 *
 * In production `worker.js` intercepts `/api/op/*` before OpenNext ever runs, so
 * this handler is only reached under `next dev` (which never executes
 * `worker.js`). Both paths share the implementation in `op-proxy.ts` — see the
 * comment there for why the split exists.
 *
 * Fix the import to match where the analytics folder landed.
 */
import { handleOpProxy } from "@/analytics/server/op-proxy"

export async function POST(request: Request, ctx: { params: Promise<{ all: string[] }> }) {
  return handleOpProxy(request, (await ctx.params).all)
}

export async function GET(request: Request, ctx: { params: Promise<{ all: string[] }> }) {
  return handleOpProxy(request, (await ctx.params).all)
}
