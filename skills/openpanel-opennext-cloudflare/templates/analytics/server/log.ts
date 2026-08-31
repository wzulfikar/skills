/**
 * Dev-only tracing for analytics.
 *
 * Analytics are fire-and-forget by design, which makes them invisible when they
 * silently do nothing — a missing key, a self-gated call, a beacon the proxy
 * dropped all look identical from the outside. These lines make each call
 * observable in the dev server's stdout (a plain `console.log` is all that's
 * needed; `wrangler tail` picks them up in production).
 *
 * Off in production unless `ANALYTICS_DEBUG=true`, so a prod issue can be traced
 * without redeploying instrumented code.
 */
import { analyticsEnv } from "./config"

export const analyticsDebug =
  process.env.NODE_ENV !== "production" || process.env.ANALYTICS_DEBUG === "true"

/** Whether server-side tracking is actually configured. Absent = silent no-op. */
function configured(): boolean {
  return !!(analyticsEnv.OPENPANEL_CLIENT_ID && analyticsEnv.OPENPANEL_CLIENT_SECRET)
}

function format(value: unknown): string {
  if (value === undefined) return ""
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Log one server-side call. `detail` is the human-meaningful part (event name,
 * amount); `props` is the payload, printed only when present.
 */
export function logAnalytics(kind: string, detail: string, props?: Record<string, unknown>): void {
  if (!analyticsDebug) return
  const target = configured() ? "openpanel" : "NOT CONFIGURED — dropping"
  const payload = props && Object.keys(props).length > 0 ? ` ${format(props)}` : ""
  console.log(`[analytics] ${kind} ${detail}${payload} → ${target}`)
}

/** Confirm a call actually reached the API (or didn't). */
export function logProvider(action: string, ok: boolean, note?: string): void {
  if (!analyticsDebug) return
  console.log(`[analytics] openpanel ${action} ${ok ? "ok" : "FAILED"}${note ? ` ${note}` : ""}`)
}
