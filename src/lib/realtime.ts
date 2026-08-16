import {
  applyAccountEquities,
  rankTrackedAccounts,
  type TrackerMetrics,
} from "./tracker-metrics.ts";
import type { Trade } from "./types.ts";

export const PUBLIC_REALTIME_KEY = "lighterscan:public-realtime:v1";
export const PUBLIC_REALTIME_STALE_MS = 15_000;
const LIVE_TRADE_LIMIT = 100;
const TRACKER_SOURCE_LIMIT = 1_200;
const TRACKER_MARKET_LIMIT = 6;

export type RealtimeMarket = {
  marketId: number;
  symbol: string;
};

export type PublicRealtimeSnapshot = {
  version: 1;
  updatedAt: number;
  trades: Trade[];
  trackers: {
    whales: TrackerMetrics[];
    highFrequency: TrackerMetrics[];
    sampledTrades: number;
    windowStart: number;
    windowEnd: number;
    markets: string[];
  };
};

export function buildPublicRealtimeSnapshot(
  trades: Trade[],
  markets: RealtimeMarket[],
  updatedAt = Date.now(),
  equities: Record<number, { collateral?: number; totalAssetValue?: number }> = {},
): PublicRealtimeSnapshot {
  const source = trades.slice(0, TRACKER_SOURCE_LIMIT);
  const trackerMarkets = markets.slice(0, TRACKER_MARKET_LIMIT);
  const trackerMarketIds = new Set(
    trackerMarkets.map((market) => market.marketId),
  );
  const trackerSource = source.filter((trade) =>
    trackerMarketIds.has(trade.marketId),
  );
  const ranking = applyAccountEquities(
    rankTrackedAccounts(trackerSource, 40),
    equities,
    20,
  );
  let windowStart = Number.POSITIVE_INFINITY;
  let windowEnd = 0;
  for (const trade of trackerSource) {
    windowStart = Math.min(windowStart, trade.timestamp);
    windowEnd = Math.max(windowEnd, trade.timestamp);
  }
  return {
    version: 1,
    updatedAt,
    trades: source.slice(0, LIVE_TRADE_LIMIT),
    trackers: {
      ...ranking,
      sampledTrades: trackerSource.length,
      windowStart: Number.isFinite(windowStart) ? windowStart : 0,
      windowEnd,
      markets: trackerMarkets.map((market) => market.symbol),
    },
  };
}

export function isPublicRealtimeSnapshot(
  value: unknown,
): value is PublicRealtimeSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PublicRealtimeSnapshot>;
  if (
    candidate.version !== 1 ||
    !Number.isFinite(candidate.updatedAt) ||
    !Array.isArray(candidate.trades) ||
    !candidate.trackers ||
    typeof candidate.trackers !== "object"
  ) {
    return false;
  }
  return (
    Array.isArray(candidate.trackers.whales) &&
    Array.isArray(candidate.trackers.highFrequency) &&
    Array.isArray(candidate.trackers.markets) &&
    Number.isFinite(candidate.trackers.sampledTrades) &&
    Number.isFinite(candidate.trackers.windowStart) &&

    Number.isFinite(candidate.trackers.windowEnd)
  );
}
export function parseLighterTradeMessage(
  value: unknown,
  marketSymbols: ReadonlyMap<number, string>,
  receivedAt = Date.now(),
): Trade[] {
  if (!value || typeof value !== "object") return [];
  const message = value as Record<string, unknown>;
  if (!String(message.type ?? "").includes("trade")) return [];
  const rawTrades = [
    ...(Array.isArray(message.trades) ? message.trades : []),
    ...(Array.isArray(message.liquidation_trades)
      ? message.liquidation_trades
      : []),
  ];
  const trades: Trade[] = [];
  for (const [index, value] of rawTrades.entries()) {
    if (!value || typeof value !== "object") continue;
    const raw = value as Record<string, unknown>;
    const marketId = Number(raw.market_id ?? 0);
    const size = Number(raw.size ?? 0);
    const price = Number(raw.price ?? 0);
    if (
      !Number.isFinite(marketId) ||
      marketId <= 0 ||
      !Number.isFinite(size) ||
      size <= 0 ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      continue;
    }
    const timestampValue = Number(raw.timestamp ?? receivedAt);
    const timestamp = Number.isFinite(timestampValue)
      ? timestampValue
      : receivedAt;
    const txHash = String(raw.tx_hash ?? "");
    const isMakerAsk =
      raw.is_maker_ask === true ||
      raw.is_maker_ask === 1 ||
      raw.is_maker_ask === "true";
    const rawUsdAmount = Number(raw.usd_amount ?? 0);
    trades.push({
      tradeId: String(
        raw.trade_id_str ??
          raw.trade_id ??
          `${txHash}:${marketId}:${timestamp}:${index}`,
      ),
      txHash,
      type: String(raw.type ?? "trade"),
      marketId,
      symbol: marketSymbols.get(marketId),
      size,
      price,
      usdAmount:
        Number.isFinite(rawUsdAmount) && rawUsdAmount > 0
          ? rawUsdAmount
          : price * size,
      askAccountId: Number(raw.ask_account_id ?? 0),
      bidAccountId: Number(raw.bid_account_id ?? 0),
      isMakerAsk,
      timestamp,
      takerIsAsk: !isMakerAsk,
    });
  }
  return trades;
}

export function isRealtimeSnapshotFresh(
  snapshot: PublicRealtimeSnapshot,
  now = Date.now(),
): boolean {
  const age = now - snapshot.updatedAt;
  return age >= -5_000 && age <= PUBLIC_REALTIME_STALE_MS;
}
