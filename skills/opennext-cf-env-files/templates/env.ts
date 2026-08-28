// Helper file to expose isomorphic env vars

/**
 * Validate env vars during CF build time.
 * Make sure to add NEXT_PUBLIC_IS_CF_BUILD=1 in CF dashboard as build var.
 */
export const IS_CF_BUILD = !!process.env.NEXT_PUBLIC_IS_CF_BUILD;

export const IS_DEV = !IS_CF_BUILD;

/**
 * Validate env vars when running CF worker.
 */
export const IS_CF_WORKER =
  // workerd sets this UA. No dashboard var needed.
  (typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers") ||
  // use IS_CF_WORKER=1 to override worker detection for local dev testing
  !!process.env.IS_CF_WORKER;

export const parseEnv = (requiredEnv: object, runtime: "server" | "client") => {
  if (runtime === "server" ? IS_CF_WORKER : IS_CF_BUILD) {
    const missingVars = [];
    for (const key in requiredEnv) {
      if (!requiredEnv[key as keyof typeof requiredEnv]) missingVars.push(key);
    }
    if (missingVars.length > 0) {
      const errorType = IS_CF_WORKER ? "worker error" : "build error";
      throw new Error(
        `[${errorType}] [env.${runtime}.ts] Missing environment variables: ${missingVars.join(", ")}`,
      );
    }
  }
};
