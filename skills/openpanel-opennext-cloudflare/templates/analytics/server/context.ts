/**
 * Pull the end user's network identity off an incoming request.
 *
 * Server events are sent from our own infrastructure, so the caller's IP and
 * user agent must be forwarded explicitly — otherwise every event is
 * geo-attributed to the Cloudflare colo instead of the visitor.
 */
import type { RequestContext } from "../types"

export function getRequestContext(request: Request): RequestContext {
  // X-Forwarded-For can be a comma list ("client, proxy1, …"); providers want a
  // single address, so take the first (client) hop.
  const ip =
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    undefined

  return {
    ip,
    userAgent: request.headers.get("User-Agent") || undefined,
  }
}
