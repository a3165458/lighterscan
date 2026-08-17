import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { getSharedRedis, resolveSharedCacheBackend } from "./shared-kv.ts";

export type PublicRateLimitScope = "history" | "search";
export type PublicRateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  unavailable?: boolean;
};

const limits: Record<PublicRateLimitScope, number> = {
  history: 60,
  search: 30,
};
const limiters = new Map<PublicRateLimitScope, Ratelimit>();
const localWindows = new Map<string, { count: number; reset: number }>();

/** After Upstash quota/network errors, skip Redis commands for a minute. */
export const RATE_LIMIT_CIRCUIT_MS = 60_000;
let circuitOpenUntil = 0;

export function requestFingerprint(headers: Headers, secret: string): string {
  const forwarded =
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-forwarded-for") ??
    headers.get("x-real-ip") ??
    "unknown";
  const address = forwarded.split(",", 1)[0]?.trim() || "unknown";
  const identity = `${address}|${headers.get("user-agent") ?? "unknown"}`;
  return createHmac("sha256", secret).update(identity).digest("hex");
}

export function shouldUseRemoteRateLimit(
  backend = resolveSharedCacheBackend(),
  now = Date.now(),
  circuitUntil = circuitOpenUntil,
): boolean {
  return backend === "upstash" && now >= circuitUntil;
}

export function localPublicRateLimit(
  scope: PublicRateLimitScope,
  identifier: string,
  now: number,
): PublicRateLimitResult {
  const limit = limits[scope];
  const key = `${scope}:${identifier}`;
  const existing = localWindows.get(key);
  const window = !existing || existing.reset <= now
    ? { count: 0, reset: now + 60_000 }
    : existing;
  window.count += 1;
  localWindows.set(key, window);
  return {
    success: window.count <= limit,
    limit,
    remaining: Math.max(0, limit - window.count),
    reset: window.reset,
  };
}

export async function settleRateLimit(
  scope: PublicRateLimitScope,
  identifier: string,
  now: number,
  remote: (() => Promise<PublicRateLimitResult>) | null,
): Promise<PublicRateLimitResult> {
  if (!remote) return localPublicRateLimit(scope, identifier, now);
  try {
    return await remote();
  } catch {
    circuitOpenUntil = now + RATE_LIMIT_CIRCUIT_MS;
    return localPublicRateLimit(scope, identifier, now);
  }
}

export async function checkPublicRateLimit(
  headers: Headers,
  scope: PublicRateLimitScope,
): Promise<PublicRateLimitResult> {
  const secret =
    process.env.RATE_LIMIT_SALT ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    "lighterscan-local";
  const identifier = requestFingerprint(headers, secret);
  const now = Date.now();
  if (!shouldUseRemoteRateLimit()) {
    return localPublicRateLimit(scope, identifier, now);
  }

  const redis = getSharedRedis();
  if (!redis) {
    return localPublicRateLimit(scope, identifier, now);
  }

  let limiter = limiters.get(scope);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limits[scope], "1 m"),
      analytics: false,
      prefix: `lighterscan:ratelimit:${scope}`,
    });
    limiters.set(scope, limiter);
  }
  return settleRateLimit(scope, identifier, now, async () => {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  });
}

export function rateLimitHeaders(
  result: PublicRateLimitResult,
): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.reset / 1_000)),
  };
}

export function resetPublicRateLimitForTests(): void {
  localWindows.clear();
  limiters.clear();
  circuitOpenUntil = 0;
}
