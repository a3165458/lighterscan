import { Redis } from "@upstash/redis";
import {
  isPublicRealtimeSnapshot,
  PUBLIC_REALTIME_KEY,
  type PublicRealtimeSnapshot,
} from "./realtime.ts";
import {
  emptyTrackerLedger,
  isTrackerLedger,
  type TrackerLedger,
} from "./tracker-ledger.ts";
export const PUBLIC_STATS_KEY = "lighterscan:public-stats:v1";
export const PUBLIC_TRACKER_LEDGER_KEY = "lighterscan:tracker-ledger:v1";
const STATS_TTL_SECONDS = 14 * 24 * 60 * 60;
const TRACKER_LEDGER_TTL_SECONDS = 30 * 24 * 60 * 60;
export type HourlyStat = {
  t: number;
  volume: number;
  trades: number;
  openInterest: number;
  liquidations: number;
};
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
  if (!isPublicRealtimeSnapshot(value)) return null;
  return {
    ...value,
    liquidations: value.liquidations ?? [],
    positions: value.positions ?? [],
  };
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

export async function readHourlyStats(): Promise<HourlyStat[]> {
  const redis = getSharedRedis();
  if (!redis) return [];
  const value = await redis.get<unknown>(PUBLIC_STATS_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is HourlyStat => {
    if (!row || typeof row !== "object") return false;
    const stat = row as HourlyStat;
    return (
      Number.isFinite(stat.t) &&
      Number.isFinite(stat.volume) &&
      Number.isFinite(stat.trades) &&
      Number.isFinite(stat.openInterest) &&
      Number.isFinite(stat.liquidations)
    );
  });
}

export async function writeHourlyStat(stat: HourlyStat): Promise<void> {
  const redis = getSharedRedis();
  if (!redis) return;
  const bucket = Math.floor(stat.t / 900_000) * 900_000;
  const next = readHourlyStats().then((rows) => {
    const kept = rows.filter((row) => row.t !== bucket);
    kept.push({ ...stat, t: bucket });
    kept.sort((a, b) => a.t - b.t);
    return kept.slice(-336);
  });
  await redis.set(PUBLIC_STATS_KEY, await next, { ex: STATS_TTL_SECONDS });
}

export async function readTrackerLedger(): Promise<TrackerLedger | null> {
  const redis = getSharedRedis();
  if (!redis) return null;
  const value = await redis.get<unknown>(PUBLIC_TRACKER_LEDGER_KEY);
  return isTrackerLedger(value) ? value : null;
}

export async function writeTrackerLedger(ledger: TrackerLedger): Promise<void> {
  const redis = getSharedRedis();
  if (!redis) return;
  await redis.set(PUBLIC_TRACKER_LEDGER_KEY, ledger, {
    ex: TRACKER_LEDGER_TTL_SECONDS,
  });
}

export async function loadOrCreateTrackerLedger(): Promise<TrackerLedger> {
  return (await readTrackerLedger()) ?? emptyTrackerLedger();
}
