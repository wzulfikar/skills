/**
 * Server-side analytics — events that originate on our own infrastructure:
 * route handlers, webhooks, cron. Browser events do NOT come through here; they
 * go straight to ./op-proxy from ../client.
 *
 * Self-gates on `OPENPANEL_CLIENT_SECRET` — without it the API rejects events
 * that originate outside a browser, so a missing key is a silent no-op.
 *
 * Never throws: analytics must not be able to fail a request.
 *
 * This is the seam. If a second provider is ever added, fan out from these
 * functions and every call site stays the same.
 */
import { OpenPanel } from "@openpanel/sdk"
import type { EventName } from "../events"
import type { RequestContext } from "../types"
import { analyticsEnv } from "./config"
import { logAnalytics, logProvider } from "./log"

export { EVENTS } from "../events"
export type { EventName } from "../events"
export { getRequestContext } from "./context"
export type { RequestContext } from "../types"

function enabled(): boolean {
  return !!(analyticsEnv.OPENPANEL_CLIENT_ID && analyticsEnv.OPENPANEL_CLIENT_SECRET)
}

/**
 * Build a request-scoped client.
 *
 * OpenPanel derives geo (country, city) and device (os, browser) from the
 * caller's IP and user agent. Server events leave our own infrastructure, so
 * both must be forwarded explicitly or every event is attributed to the
 * Cloudflare colo instead of the end user.
 *
 * These headers are per-request, so each call builds its own client rather than
 * mutating a shared singleton, which would race across concurrent requests.
 */
function createClient(context?: RequestContext): OpenPanel {
  const op = new OpenPanel({
    clientId: analyticsEnv.OPENPANEL_CLIENT_ID as string,
    clientSecret: analyticsEnv.OPENPANEL_CLIENT_SECRET,
    apiUrl: analyticsEnv.OPENPANEL_API_URL,
  })

  if (context?.ip) {
    op.api.addHeader("openpanel-client-ip", context.ip)
    op.api.addHeader("x-client-ip", context.ip)
  }
  if (context?.userAgent) op.api.addHeader("user-agent", context.userAgent)

  return op
}

export interface TrackArgs extends RequestContext {
  event: EventName
  /** Stable id for the visitor, when there is one. Anonymous otherwise. */
  profileId?: string
  props?: Record<string, unknown>
}

/**
 * Record a server-side event. Always `await` it.
 *
 * The Cloudflare Worker is frozen the moment a response is returned, so a
 * fire-and-forget HTTP request is killed before it completes and the event
 * never arrives. `await` it inside the handler, or hand it to
 * `ctx.waitUntil()` via `getCloudflareContext()` from `@opennextjs/cloudflare`.
 */
export async function track({ event, profileId, props, ...context }: TrackArgs): Promise<void> {
  logAnalytics("event", event, props)
  if (!enabled()) return
  try {
    await createClient(context).track(event, { ...(profileId ? { profileId } : {}), ...props })
    logProvider(`track ${event}`, true)
  } catch (err) {
    logProvider(`track ${event}`, false)
    console.warn("[analytics.track] failed:", err)
  }
}

export interface IdentifyArgs extends RequestContext {
  profileId: string
  props?: Record<string, unknown>
}

/** Attach properties to a profile. Keep PII out unless you mean to store it. */
export async function identify({ profileId, props, ...context }: IdentifyArgs): Promise<void> {
  logAnalytics("identify", profileId, props)
  if (!enabled()) return
  try {
    await createClient(context).identify({ profileId, properties: props ?? {} })
    logProvider("identify", true)
  } catch (err) {
    logProvider("identify", false)
    console.warn("[analytics.identify] failed:", err)
  }
}

export interface RevenueArgs extends RequestContext {
  amount: number
  currency: string
  /** Unique billing id, carried so duplicates can be spotted downstream. */
  transactionId: string
  profileId?: string
  props?: Record<string, unknown>
}

/**
 * Record revenue through OpenPanel's native `revenue()`, which posts a `revenue`
 * event carrying `__revenue`.
 *
 * `profileId` is optional because webhooks (Stripe, RevenueCat) often have no
 * visitor in scope. Without context the event is geo-attributed to the colo —
 * fine for totals, wrong for revenue-by-country.
 */
export async function revenue({
  amount,
  currency,
  transactionId,
  profileId,
  props,
  ...context
}: RevenueArgs): Promise<void> {
  logAnalytics("revenue", `${amount} ${currency}`, props)
  if (!enabled()) return
  try {
    await createClient(context).revenue(amount, {
      currency,
      transaction_id: transactionId,
      ...(profileId ? { profileId } : {}),
      ...props,
    })
    logProvider(`revenue ${amount} ${currency}`, true)
  } catch (err) {
    logProvider(`revenue ${amount} ${currency}`, false)
    console.warn("[analytics.revenue] failed:", err)
  }
}
