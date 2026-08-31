/**
 * Server-only analytics config. Never import this from client code — it reads
 * the secret.
 *
 * Read straight from `process.env` rather than through a typed `@/env.server`
 * module: `worker.js` reaches this file through ./op-proxy and is bundled by
 * Wrangler, where the tsconfig aliases are not reliably in play. Every value is
 * optional and each entry point self-gates, so a missing key is a silent no-op
 * rather than a boot failure.
 */
import { OPENPANEL_DEFAULT_API_URL } from "../config"

export const analyticsEnv = {
  /**
   * The public name on purpose, server side included: Next substitutes
   * `NEXT_PUBLIC_*` at BUILD time across both bundles, so this resolves to a
   * literal here. Which also means a Worker `vars` entry can never reach it —
   * the id has to be in the build environment.
   *
   * The one bundle Next does not compile is `worker.js`, where this stays
   * undefined. Nothing on that path needs it: the proxy forwards the browser's
   * own `openpanel-client-id` header and reads only the secret and API url.
   */
  OPENPANEL_CLIENT_ID: process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
  /**
   * Worker RUNTIME secret. `wrangler secret put OPENPANEL_CLIENT_SECRET` — never
   * a plaintext `vars` entry, which is world-readable in the config file.
   */
  OPENPANEL_CLIENT_SECRET: process.env.OPENPANEL_CLIENT_SECRET,
  /** Set when self-hosting; otherwise the hosted API. */
  OPENPANEL_API_URL: process.env.OPENPANEL_API_URL || OPENPANEL_DEFAULT_API_URL,
}
