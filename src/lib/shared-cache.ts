import { LIVE_POLL_MS } from "./poll.ts";
import {
  isPublicRealtimeSnapshot,
  PUBLIC_REALTIME_KEY,
  type PublicRealtimeSnapshot,
} from "./realtime.ts";
import { getSharedKv, isSharedCacheConfigured } from "./shared-kv.ts";
import {
  emptyTrackerLedger,
  isTrackerLedger,
  type TrackerLedger,
} from "./tracker-ledger.ts";

export {
  getSharedKv,
  getSharedRedis,
  isSharedCacheConfigured,
  resolveSharedCacheBackend,
  resolveTcpRedisOptions,
  setSharedKvForTests,
  resetSharedKvForTests,
} from "./shared-kv.ts";

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

/** One Redis GET per isolate per window, aligned with the live poll. */
export const SNAPSHOT_MEMO_MS = LIVE_POLL_MS;

type SnapshotMemo = {
  value: PublicRealtimeSnapshot | null;
  exp: number;
  inflight?: Promise<PublicRealtimeSnapshot | null>;
};

let snapshotMemo: SnapshotMemo | null = null;

function normalizeSnapshot(
  value: unknown,
): PublicRealtimeSnapshot | null {
  if (!isPublicRealtimeSnapshot(value)) return null;
  return {
    ...value,
    liquidations: value.liquidations ?? [],
    positions: value.positions ?? [],
  };
}

export function publicRealtimeTransport(): "direct" | "shared" {
  if (process.env.PUBLIC_REALTIME_MODE === "direct") return "direct";
  return isSharedCacheConfigured() ? "shared" : "direct";
}

export function resetSnapshotMemoForTests(): void {
  snapshotMemo = null;
}

export function expireSnapshotMemoForTests(): void {
  if (snapshotMemo) snapshotMemo.exp = 0;
}

export async function readPublicRealtimeSnapshot(): Promise<PublicRealtimeSnapshot | null> {
  const now = Date.now();
  if (snapshotMemo && snapshotMemo.exp > now) return snapshotMemo.value;
  if (snapshotMemo?.inflight) return snapshotMemo.inflight;

  const inflight = (async () => {
    try {
      const kv = getSharedKv();
      if (!kv) {
        snapshotMemo = { value: snapshotMemo?.value ?? null, exp: now + SNAPSHOT_MEMO_MS };
        return snapshotMemo.value;
      }
      const parsed = normalizeSnapshot(await kv.get<unknown>(PUBLIC_REALTIME_KEY));
      snapshotMemo = { value: parsed, exp: Date.now() + SNAPSHOT_MEMO_MS };
      return parsed;
    } catch {
      const fallback = snapshotMemo?.value ?? null;
      snapshotMemo = { value: fallback, exp: Date.now() + SNAPSHOT_MEMO_MS };
      return fallback;
    }
  })();

  snapshotMemo = {
    value: snapshotMemo?.value ?? null,
    exp: snapshotMemo?.exp ?? 0,
    inflight,
  };
  return inflight;
}

export async function writePublicRealtimeSnapshot(
  snapshot: PublicRealtimeSnapshot,
): Promise<void> {
  const kv = getSharedKv();
  if (!kv) {
    throw new Error("Redis credentials are required");
  }
  await kv.set(PUBLIC_REALTIME_KEY, snapshot, {
    ex: REALTIME_TTL_SECONDS,
  });
  snapshotMemo = { value: snapshot, exp: Date.now() + SNAPSHOT_MEMO_MS };
}

export async function readHourlyStats(): Promise<HourlyStat[]> {
  try {
    const kv = getSharedKv();
    if (!kv) return [];
    const value = await kv.get<unknown>(PUBLIC_STATS_KEY);
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
  } catch {
    return [];
  }
}

export async function writeHourlyStat(stat: HourlyStat): Promise<void> {
  const kv = getSharedKv();
  if (!kv) return;
  const bucket = Math.floor(stat.t / 900_000) * 900_000;
  const next = readHourlyStats().then((rows) => {
    const kept = rows.filter((row) => row.t !== bucket);
    kept.push({ ...stat, t: bucket });
    kept.sort((a, b) => a.t - b.t);
    return kept.slice(-336);
  });
  try {
    await kv.set(PUBLIC_STATS_KEY, await next, { ex: STATS_TTL_SECONDS });
  } catch {
    /* Quota or network — stats are best-effort. */
  }
}

export async function readTrackerLedger(): Promise<TrackerLedger | null> {
  try {
    const kv = getSharedKv();
    if (!kv) return null;
    const value = await kv.get<unknown>(PUBLIC_TRACKER_LEDGER_KEY);
    return isTrackerLedger(value) ? value : null;
  } catch {
    return null;
  }
}

export async function writeTrackerLedger(ledger: TrackerLedger): Promise<void> {
  const kv = getSharedKv();
  if (!kv) return;
  await kv.set(PUBLIC_TRACKER_LEDGER_KEY, ledger, {
    ex: TRACKER_LEDGER_TTL_SECONDS,
  });
}

export async function loadOrCreateTrackerLedger(): Promise<TrackerLedger> {
  return (await readTrackerLedger()) ?? emptyTrackerLedger();
}
