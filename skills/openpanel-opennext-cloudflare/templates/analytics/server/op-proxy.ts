/**
 * First-party proxy for the OpenPanel browser client.
 *
 * The client posts to `/api/op/*` on our own origin instead of
 * `api.openpanel.dev`, so ad blockers — which block the vendor domain by name —
 * don't silently shrink the numbers. This forwards `/api/op/track` on to
 * `{OPENPANEL_API_URL}/track`.
 *
 * Because the request now originates from the Worker, the visitor's IP and user
 * agent are attached explicitly; otherwise every browser event would be
 * geo-attributed to the Cloudflare colo.
 *
 * Lives here, not in the route handler, because two entry points need it:
 * `worker.js` short-circuits these requests before OpenNext sees them (beacons
 * are the highest-volume path on the site, and the Next server pipeline is pure
 * overhead for a pass-through fetch), while the catch-all route at
 * `src/app/api/op/[...all]/route.ts` keeps the path working under `next dev`,
 * which never executes `worker.js`.
 *
 * Only relative imports on this path — `worker.js` is bundled by Wrangler rather
 * than Next, so the `@/` and `@shared/` aliases are not in play.
 */
import { analyticsEnv } from "./config"
import { analyticsDebug } from "./log"

export { OPENPANEL_PROXY_PATH } from "../config"

/** Headers worth passing through. Everything else (cookie, host, …) is dropped. */
const FORWARDED = [
  "content-type",
  "openpanel-client-id",
  "openpanel-sdk-name",
  "openpanel-sdk-version",
]

export async function handleOpProxy(request: Request, path: string[]): Promise<Response> {
  const target = `${analyticsEnv.OPENPANEL_API_URL}/${path.join("/")}`

  const headers = new Headers()
  for (const name of FORWARDED) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
  if (ip) {
    // Both spellings appear in OpenPanel's own SDKs; sending both costs nothing
    // and guarantees the one the API reads is present.
    headers.set("openpanel-client-ip", ip)
    headers.set("x-client-ip", ip)
  }

  const userAgent = request.headers.get("user-agent")
  if (userAgent) headers.set("user-agent", userAgent)

  // The API authorises browser-originated events by matching `origin` against
  // the client's CORS allowlist — without it the request looks server-side and
  // is rejected with `401 Ingestion: Invalid cors or secret`. Proxying strips
  // the browser's own origin, so it has to be re-attached. Falls back to our own
  // origin the way OpenPanel's `createRouteHandler` does, for the GET beacons
  // that carry no `Origin` at all.
  const url = new URL(request.url)
  headers.set("origin", request.headers.get("origin") ?? `${url.protocol}//${url.host}`)

  // Origin alone only works when the client's CORS allowlist in the OpenPanel
  // dashboard names this exact origin — which silently breaks on localhost,
  // preview branches and any domain change (the API answers
  // `401 Ingestion: Invalid cors or secret`). The secret authorises regardless
  // of origin and never leaves the Worker, so send it when configured.
  if (analyticsEnv.OPENPANEL_CLIENT_SECRET) {
    headers.set("openpanel-client-secret", analyticsEnv.OPENPANEL_CLIENT_SECRET)
  }

  const body = request.method === "GET" ? undefined : await request.text()

  if (analyticsDebug) {
    // The browser client's events only become visible here — this is the one
    // point where a beacon passes through our own logs.
    let summary = body ?? ""
    try {
      const parsed = JSON.parse(body ?? "{}")
      const name = parsed?.payload?.name ?? parsed?.type ?? "?"
      const screen = parsed?.payload?.properties?.__path ?? parsed?.payload?.properties?.screen
      summary = screen ? `${name} ${screen}` : name
    } catch {
      // keep the raw body when it isn't the shape we expect
    }
    console.log(`[analytics] web ${path.join("/")} ${summary} ip=${ip ?? "?"}`)
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
    })

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    })
  } catch (err) {
    // A failed analytics beacon must never surface as a browser error.
    console.warn("[api/op] proxy failed:", err)
    return Response.json({ ok: false }, { status: 202 })
  }
}
