import type { Trade } from "./types.ts";
import {
  accountEquity,
  applyTradeToAccounts,
  finalizeMetrics,
  trackerTradeKey,
  type FrozenTrackerSample,
  type MutableMetrics,
  type TrackerMetrics,
} from "./tracker-metrics.ts";

export const ALL_TRACKER_BUCKET = "all";
const RECENT_KEY_LIMIT = 4_000;
const ALL_ACCOUNT_LIMIT = 1_500;
const MARKET_ACCOUNT_LIMIT = 250;

export type StoredTrackerAccount = {
  accountId: number;
  tradeCount: number;
  makerTrades: number;
  takerTrades: number;
  buyTrades: number;
  sellTrades: number;
  observedNotional: number;
  largestTrade: number;
  symbols: string[];
  firstSeen: number;
  lastSeen: number;
  accountValue: number;
};

export type TrackerBucket = {
  sampledTrades: number;
  windowStart: number;
  windowEnd: number;
  markets: string[];
  accounts: Record<string, StoredTrackerAccount>;
};

export type TrackerLedger = {
  version: 1;
  updatedAt: number;
  recentKeys: string[];
  buckets: Record<string, TrackerBucket>;
};

export function emptyTrackerLedger(now = Date.now()): TrackerLedger {
  return { version: 1, updatedAt: now, recentKeys: [], buckets: {} };
}

export function isTrackerLedger(value: unknown): value is TrackerLedger {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TrackerLedger>;
  return (
    candidate.version === 1 &&
    Number.isFinite(candidate.updatedAt) &&
    Array.isArray(candidate.recentKeys) &&
    !!candidate.buckets &&
    typeof candidate.buckets === "object"
  );
}

function emptyBucket(): TrackerBucket {
  return {
    sampledTrades: 0,
    windowStart: 0,
    windowEnd: 0,
    markets: [],
    accounts: {},
  };
}

function toMutable(row: StoredTrackerAccount): MutableMetrics {
  return {
    accountId: row.accountId,
    tradeCount: row.tradeCount,
    makerTrades: row.makerTrades,
    takerTrades: row.takerTrades,
    buyTrades: row.buyTrades,
    sellTrades: row.sellTrades,
    observedNotional: row.observedNotional,
    largestTrade: row.largestTrade,
    symbols: new Set(row.symbols),
    firstSeen: row.firstSeen || Number.POSITIVE_INFINITY,
    lastSeen: row.lastSeen,
    accountValue: row.accountValue,
  };
}

function toStored(metrics: MutableMetrics): StoredTrackerAccount {
  const finalized = finalizeMetrics(metrics);
  return {
    accountId: finalized.accountId,
    tradeCount: finalized.tradeCount,
    makerTrades: finalized.makerTrades,
    takerTrades: finalized.takerTrades,
    buyTrades: finalized.buyTrades,
    sellTrades: finalized.sellTrades,
    observedNotional: finalized.observedNotional,
    largestTrade: finalized.largestTrade,
    symbols: finalized.symbols,
    firstSeen: finalized.firstSeen,
    lastSeen: finalized.lastSeen,
    accountValue: finalized.accountValue,
  };
}

function applyTradeToBucket(bucket: TrackerBucket, trade: Trade): void {
  const accounts = new Map<number, MutableMetrics>();
  for (const accountId of [trade.askAccountId, trade.bidAccountId]) {
    const row = bucket.accounts[String(accountId)];
    if (row) accounts.set(accountId, toMutable(row));
  }
  applyTradeToAccounts(accounts, trade);
  for (const [accountId, metrics] of accounts) {
    bucket.accounts[String(accountId)] = toStored(metrics);
  }
  const symbol = trade.symbol || `#${trade.marketId}`;
  bucket.sampledTrades += 1;
  bucket.windowStart = bucket.windowStart
    ? Math.min(bucket.windowStart, trade.timestamp)
    : trade.timestamp;
  bucket.windowEnd = Math.max(bucket.windowEnd, trade.timestamp);
  if (symbol && !bucket.markets.includes(symbol)) bucket.markets.push(symbol);
}

function pruneBucket(bucket: TrackerBucket, limit: number): void {
  const rows = Object.values(bucket.accounts);
  if (rows.length <= limit) return;
  rows.sort(
    (a, b) =>
      b.accountValue - a.accountValue ||
      b.observedNotional - a.observedNotional ||
      b.largestTrade - a.largestTrade,
  );
  bucket.accounts = Object.fromEntries(
    rows.slice(0, limit).map((row) => [String(row.accountId), row]),
  );
}

export function applyTradesToLedger(
  ledger: TrackerLedger,
  trades: Trade[],
  now = Date.now(),
): { ledger: TrackerLedger; applied: number } {
  const seen = new Set(ledger.recentKeys);
  let applied = 0;
  const nextKeys = [...ledger.recentKeys];
  for (const trade of trades) {
    const key = trackerTradeKey(trade);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    nextKeys.push(key);
    const all = ledger.buckets[ALL_TRACKER_BUCKET] ?? emptyBucket();
    applyTradeToBucket(all, trade);
    ledger.buckets[ALL_TRACKER_BUCKET] = all;
    const symbol = trade.symbol || `#${trade.marketId}`;
    const market = ledger.buckets[symbol] ?? emptyBucket();
    applyTradeToBucket(market, trade);
    ledger.buckets[symbol] = market;
    applied += 1;
  }
  ledger.recentKeys = nextKeys.slice(-RECENT_KEY_LIMIT);
  if (applied) {
    ledger.updatedAt = now;
    for (const [key, bucket] of Object.entries(ledger.buckets)) {
      pruneBucket(
        bucket,
        key === ALL_TRACKER_BUCKET ? ALL_ACCOUNT_LIMIT : MARKET_ACCOUNT_LIMIT,
      );
    }
  }
  return { ledger, applied };
}

export function applyEquitiesToLedger(
  ledger: TrackerLedger,
  equities: Record<
    number,
    number | { collateral?: number; totalAssetValue?: number }
  >,
): TrackerLedger {
  for (const bucket of Object.values(ledger.buckets)) {
    for (const [accountId, raw] of Object.entries(equities)) {
      const value = typeof raw === "number" ? raw : accountEquity(raw);
      if (!Number.isFinite(value) || value <= 0) continue;
      const row = bucket.accounts[accountId];
      if (row) row.accountValue = value;
    }
  }
  return ledger;
}

export function ledgerBucketToSample(
  ledger: TrackerLedger,
  bucketKey: string,
  limit = 40,
): FrozenTrackerSample {
  const bucket = ledger.buckets[bucketKey];
  if (!bucket) {
    return {
      whales: [],
      sampledTrades: 0,
      windowStart: 0,
      windowEnd: 0,
      markets: bucketKey === ALL_TRACKER_BUCKET ? [] : [bucketKey],
    };
  }
  const whales: TrackerMetrics[] = Object.values(bucket.accounts)
    .map((row) =>
      finalizeMetrics({
        ...toMutable(row),
        accountValue: row.accountValue,
      }),
    )
    .sort(
      (a, b) =>
        b.accountValue - a.accountValue ||
        b.observedNotional - a.observedNotional ||
        b.largestTrade - a.largestTrade,
    )
    .slice(0, Math.min(Math.max(limit, 1), 100));
  return {
    whales,
    sampledTrades: bucket.sampledTrades,
    windowStart: bucket.windowStart,
    windowEnd: bucket.windowEnd,
    markets:
      bucketKey === ALL_TRACKER_BUCKET
        ? [...bucket.markets].sort((a, b) => a.localeCompare(b))
        : [bucketKey],
  };
}
