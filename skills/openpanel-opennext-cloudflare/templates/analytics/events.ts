/**
 * The event-name catalog — the single source of truth for what this app tracks.
 *
 * Keep it dependency-free (see ./types for why) so any surface can import it.
 * Replace the placeholders below with real events; one line of comment each
 * saying WHERE it fires (client / server) pays for itself the first time a
 * number looks wrong.
 */
export const EVENTS = {
  /** client — signup form submitted. */
  SIGNUP: "signup",
  /** client — pricing/paywall shown. */
  OPEN_PAYWALL: "open_paywall",
  /** server — payment verified. Revenue goes through `revenue()`, not here. */
  PURCHASE: "purchase",
} as const

export type AppEvent = (typeof EVENTS)[keyof typeof EVENTS]

/**
 * Accepts any string so older clients — which ship hardcoded names and cannot
 * be updated retroactively — keep reporting. New call sites should use `EVENTS`,
 * so unknown names stay a legacy concern rather than a silent way to grow the
 * catalog.
 */
export type EventName = AppEvent | (string & {})

/**
 * Page views are NOT in this catalog: the browser SDK emits them itself, under
 * the reserved name `screen_view`. Don't declare an event with that name.
 */

export default EVENTS
