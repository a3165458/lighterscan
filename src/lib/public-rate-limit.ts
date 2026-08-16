import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { getSharedRedis } from "./shared-cache.ts";

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

function localLimit(
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
  const redis = getSharedRedis();
  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      return {
        success: false,
        limit: limits[scope],
        remaining: 0,
        reset: Date.now() + 60_000,
        unavailable: true,
      };
    }
    return localLimit(scope, identifier, Date.now());
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
  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch {
    return {
      success: false,
      limit: limits[scope],
      remaining: 0,
      reset: Date.now() + 60_000,
      unavailable: true,
    };
  }
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
