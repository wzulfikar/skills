/**
 * Analytics types shared by the browser client, the Worker and the Next server.
 *
 * Dependency-free on purpose — `worker.js` pulls this in through the proxy and
 * is bundled by Wrangler rather than Next.
 */

/**
 * The end user's network identity, pulled off an incoming request. Forwarded to
 * OpenPanel so geo/device enrichment describes the visitor rather than the
 * Cloudflare colo the Worker happens to run in.
 */
export interface RequestContext {
  ip?: string
  userAgent?: string
}
