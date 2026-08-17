import type { AccountLiveStats } from "./types.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;

const VOLUME_FIELDS = [
  ["daily_volume", "dailyVolume"],
  ["weekly_volume", "weeklyVolume"],
  ["monthly_volume", "monthlyVolume"],
  ["total_volume", "totalVolume"],
  ["daily_trades_count", "dailyTrades"],
  ["weekly_trades_count", "weeklyTrades"],
  ["monthly_trades_count", "monthlyTrades"],
  ["total_trades_count", "totalTrades"],
] as const;

export function emptyAccountLiveStats(): AccountLiveStats {
  return {
    dailyVolume: 0,
    weeklyVolume: 0,
    monthlyVolume: 0,
    totalVolume: 0,
    dailyTrades: 0,
    weeklyTrades: 0,
    monthlyTrades: 0,
    totalTrades: 0,
  };
}

export function aggregateVolumeFromFills(
  fills: Array<{ timestamp: number; usdAmount: number }>,
  now = Date.now(),
): AccountLiveStats {
  const stats = emptyAccountLiveStats();
  for (const fill of fills) {
    const usd = Number(fill.usdAmount);
    if (!Number.isFinite(usd) || usd <= 0) continue;
    stats.totalTrades += 1;
    stats.totalVolume += usd;
    const timestamp = Number(fill.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
    const age = now - timestamp;
    if (age <= MONTH_MS) {
      stats.monthlyTrades += 1;
      stats.monthlyVolume += usd;
    }
    if (age <= WEEK_MS) {
      stats.weeklyTrades += 1;
      stats.weeklyVolume += usd;
    }
    if (age <= DAY_MS) {
      stats.dailyTrades += 1;
      stats.dailyVolume += usd;
    }
  }
  return stats;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function applyVolumeFields(
  source: Record<string, unknown>,
  prev: AccountLiveStats | null,
): AccountLiveStats | null {
  const next = prev ? { ...prev } : emptyAccountLiveStats();
  let changed = false;
  for (const [rawKey, statsKey] of VOLUME_FIELDS) {
    if (source[rawKey] == null) continue;
    const value = Number(source[rawKey]);
    if (!Number.isFinite(value)) continue;
    next[statsKey] = value;
    changed = true;
  }
  return changed ? next : prev;
}

export type AccountStreamMerge = {
  stats: AccountLiveStats | null;
  volumeFromStream: boolean;
};

export function mergeAccountStreamMessage(
  message: unknown,
  prev: AccountLiveStats | null,
): AccountStreamMerge {
  const msg = asRecord(message);
  if (!msg) return { stats: prev, volumeFromStream: false };
  const type = String(msg.type || "");
  const channel = String(msg.channel || "");
  const topic = `${type} ${channel}`;
  if (topic.includes("account_all") && !topic.includes("orders") && !topic.includes("positions") && !topic.includes("assets")) {
    const next = applyVolumeFields(msg, prev);
    return {
      stats: next ?? prev,
      volumeFromStream: Boolean(next && next !== prev),
    };
  }
  if (topic.includes("user_stats")) {
    const stats = asRecord(msg.stats) ?? {};
    const next = prev ? { ...prev } : emptyAccountLiveStats();
    return {
      stats: {
        ...next,
        collateral: Number(stats.collateral ?? next.collateral ?? 0),
        portfolioValue: Number(stats.portfolio_value ?? next.portfolioValue ?? 0),
        leverage: Number(stats.leverage ?? next.leverage ?? 0),
        availableBalance: Number(stats.available_balance ?? next.availableBalance ?? 0),
        marginUsage: Number(stats.margin_usage ?? next.marginUsage ?? 0),
        buyingPower: Number(stats.buying_power ?? next.buyingPower ?? 0),
      },
      volumeFromStream: false,
    };
  }
  return { stats: prev, volumeFromStream: false };
}

export function tradeLogHref(txHash: string | undefined | null): string | null {
  const hash = String(txHash ?? "").trim();
  if (!hash) return null;
  return `/logs/${encodeURIComponent(hash)}`;
}
