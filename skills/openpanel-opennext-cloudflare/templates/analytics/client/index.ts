"use client"

import { OpenPanel } from "@openpanel/web"
import { openpanelClientConfig } from "../config"

export { EVENTS } from "../events"
export type { EventName } from "../events"

/**
 * Browser-side analytics client.
 *
 * Instantiated at module scope so any client component can `import { analytics }`
 * and call `analytics.track(...)` without threading a hook through the tree. The
 * SDK guards every browser API behind an internal server check, so constructing
 * it during SSR is a no-op rather than a crash.
 *
 * `apiUrl` points at our own origin (see ../config) — every beacon goes through
 * the Worker proxy, not `api.openpanel.dev`.
 *
 * Screen views are tracked manually by ./AnalyticsProvider — the SDK's built-in
 * `trackScreenViews` patches `history.pushState`, which double-fires under the
 * App Router.
 */
export const analytics = new OpenPanel({
  clientId: openpanelClientConfig.clientId,
  apiUrl: openpanelClientConfig.apiUrl,
  // Drop everything unless a client id is configured (preview branches, local
  // dev without env) and under test, where component tests would otherwise fire
  // real requests at the proxy and log connection errors.
  filter: () => !!openpanelClientConfig.clientId && process.env.NODE_ENV !== "test",
  trackScreenViews: false,
  trackOutgoingLinks: true,
  // Auto-tracks elements annotated with `data-track="event_name"`.
  trackAttributes: true,
  // Browser-console tracing in dev. These never reach the server logs; the proxy
  // logs each beacon it forwards, so they land there instead.
  debug: process.env.NODE_ENV !== "production",
})
