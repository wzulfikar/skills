// Client-side environment variables only include build vars and must
// have `NEXT_PUBLIC_` prefix so they can be inlined at build time.
//
// Development: .env (read by both `next dev` and `next build`).
// `.dev.vars` has NO effect here because the value would've been
// baked into the bundle by the time `wrangler dev` runs.

import { parseEnv } from "./env";

type NextEnvTemplateString = `NEXT_PUBLIC_${string}`;

const requiredEnv = {
  // add env vars here
} satisfies Record<NextEnvTemplateString, string>;

const optionalEnv = {
  // Example vars
  NEXT_PUBLIC_OPENPANEL_CLIENT_ID: process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID,
} satisfies Record<NextEnvTemplateString, string | undefined>;

export const env = {
  ...requiredEnv,
  ...optionalEnv,
};

parseEnv(requiredEnv, "client");
