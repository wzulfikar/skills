// Server-side environment variables include runtime vars and secrets.
// - vars (plain text): declare in the wrangler file (wrangler.jsonc / wrangler.toml)
//   under `vars`. Setting one in the dashboard does work at runtime, but `wrangler deploy`
//   overwrites dashboard vars unless `keep_vars` is set. So treat the wrangler file as the
//   source of truth.
// - secrets: add as "Secret" in Cloudflare dashboard (or `wrangler secret put NAME`). Stay
//   persisted across deployments.
//
// Development: use .dev.vars for `wrangler dev`, .env for `next dev`.

import { parseEnv } from "./env";

const requiredEnv = {
  // add env vars here
};

const optionalEnv = {
  // Example vars
  OPENPANEL_CLIENT_SECRET: process.env.OPENPANEL_CLIENT_SECRET,
};

export const env = {
  ...requiredEnv,
  ...optionalEnv,
};

parseEnv(requiredEnv, "server");
