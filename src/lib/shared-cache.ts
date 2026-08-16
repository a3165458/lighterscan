import { Redis } from "@upstash/redis";
import {
  isPublicRealtimeSnapshot,
  PUBLIC_REALTIME_KEY,
  type PublicRealtimeSnapshot,
} from "./realtime.ts";
const REALTIME_TTL_SECONDS = 10 * 60;
let client: Redis | null | undefined;

function redisCredentials(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function isSharedCacheConfigured(): boolean {
  return redisCredentials() !== null;
}

export function publicRealtimeTransport(): "direct" | "shared" {
  if (process.env.PUBLIC_REALTIME_MODE === "direct") return "direct";
  return isSharedCacheConfigured() ? "shared" : "direct";
}

export function getSharedRedis(): Redis | null {
  if (client !== undefined) return client;
  const credentials = redisCredentials();
  client = credentials ? new Redis(credentials) : null;
  return client;
}

export async function readPublicRealtimeSnapshot(): Promise<PublicRealtimeSnapshot | null> {
  const redis = getSharedRedis();
  if (!redis) return null;
  const value = await redis.get<unknown>(PUBLIC_REALTIME_KEY);
  return isPublicRealtimeSnapshot(value) ? value : null;
}

export async function writePublicRealtimeSnapshot(
  snapshot: PublicRealtimeSnapshot,
): Promise<void> {
  const redis = getSharedRedis();
  if (!redis) {
    throw new Error("Upstash Redis REST credentials are required");
  }
  await redis.set(PUBLIC_REALTIME_KEY, snapshot, {
    ex: REALTIME_TTL_SECONDS,
  });
}
