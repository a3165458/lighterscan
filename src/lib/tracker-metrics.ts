import type { HistoryFill } from "./history-map.ts";
import type { Trade } from "./types.ts";

export type TrackerMetrics = {
  accountId: number;
  tradeCount: number;
  makerTrades: number;
  takerTrades: number;
  buyTrades: number;
  sellTrades: number;
  observedNotional: number;
  averageNotional: number;
  largestTrade: number;
  makerShare: number;
  buyShare: number;
  marketCount: number;
  symbols: string[];
  firstSeen: number;
  lastSeen: number;
  tradesPerMinute: number;
  accountValue: number;
};

export type TrackerHistorySummary = Omit<TrackerMetrics, "accountId">;

type MutableMetrics = Omit<
  TrackerMetrics,
  | "averageNotional"
  | "makerShare"
  | "buyShare"
  | "marketCount"
  | "symbols"
  | "tradesPerMinute"
> & {
  symbols: Set<string>;
};

function createMetrics(accountId: number): MutableMetrics {
  return {
    accountId,
    tradeCount: 0,
    makerTrades: 0,
    takerTrades: 0,
    buyTrades: 0,
    sellTrades: 0,
    observedNotional: 0,
    largestTrade: 0,
    symbols: new Set<string>(),
    firstSeen: Number.POSITIVE_INFINITY,
    lastSeen: 0,
    accountValue: 0,
  };
}

function addObservation(
  metrics: MutableMetrics,
  observation: {
    notional: number;
    symbol: string;
    timestamp: number;
    role: "maker" | "taker";
    side: "buy" | "sell";
  },
) {
  metrics.tradeCount += 1;
  metrics.observedNotional += observation.notional;
  metrics.largestTrade = Math.max(metrics.largestTrade, observation.notional);
  metrics.symbols.add(observation.symbol);
  metrics.firstSeen = Math.min(metrics.firstSeen, observation.timestamp);
  metrics.lastSeen = Math.max(metrics.lastSeen, observation.timestamp);
  if (observation.role === "maker") metrics.makerTrades += 1;
  else metrics.takerTrades += 1;
  if (observation.side === "buy") metrics.buyTrades += 1;
  else metrics.sellTrades += 1;
}

function finalizeMetrics(metrics: MutableMetrics): TrackerMetrics {
  const activeMinutes = Math.max(
    1,
    (metrics.lastSeen - metrics.firstSeen) / 60_000,
  );
  return {
    ...metrics,
    averageNotional:
      metrics.tradeCount > 0 ? metrics.observedNotional / metrics.tradeCount : 0,
    makerShare:
      metrics.tradeCount > 0 ? metrics.makerTrades / metrics.tradeCount : 0,
    buyShare: metrics.tradeCount > 0 ? metrics.buyTrades / metrics.tradeCount : 0,
    marketCount: metrics.symbols.size,
    symbols: [...metrics.symbols].sort((a, b) => a.localeCompare(b)),
    firstSeen: Number.isFinite(metrics.firstSeen) ? metrics.firstSeen : 0,
    tradesPerMinute:
      metrics.tradeCount > 0 ? metrics.tradeCount / activeMinutes : 0,
    accountValue: metrics.accountValue,
  };
}

export function rankTrackedAccounts(
  trades: Trade[],
  limit = 20,
): { whales: TrackerMetrics[]; highFrequency: TrackerMetrics[] } {
  const accounts = new Map<number, MutableMetrics>();
  const seen = new Set<string>();

  for (const trade of trades) {
    const identity = trade.txHash || trade.tradeId;
    const key = identity ? `${trade.marketId}:${identity}` : "";
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    const notional = Math.abs(
      trade.usdAmount || trade.price * trade.size,
    );
    const symbol = trade.symbol || `#${trade.marketId}`;
    const makerAccountId = trade.isMakerAsk
      ? trade.askAccountId
      : trade.bidAccountId;
    const participants = [
      {
        accountId: trade.askAccountId,
        role: trade.askAccountId === makerAccountId ? "maker" : "taker",
        side: "sell",
      },
      {
        accountId: trade.bidAccountId,
        role: trade.bidAccountId === makerAccountId ? "maker" : "taker",
        side: "buy",
      },
    ] as const;

    const observedAccounts = new Set<number>();
    for (const participant of participants) {
      if (participant.accountId <= 0 || observedAccounts.has(participant.accountId)) {
        continue;
      }
      observedAccounts.add(participant.accountId);
      let metrics = accounts.get(participant.accountId);
      if (!metrics) {
        metrics = createMetrics(participant.accountId);
        accounts.set(participant.accountId, metrics);
      }
      addObservation(metrics, {
        notional,
        symbol,
        timestamp: trade.timestamp,
        role: participant.role,
        side: participant.side,
      });
    }
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const finalized = [...accounts.values()].map(finalizeMetrics);
  return {
    whales: [...finalized]
      .sort(
        (a, b) =>
          b.accountValue - a.accountValue ||
          b.observedNotional - a.observedNotional ||
          b.largestTrade - a.largestTrade,
      )
      .slice(0, safeLimit),
    highFrequency: [],
  };
}

export function accountEquity(account: {
  collateral?: number;
  totalAssetValue?: number;
}): number {
  const collateral = Number(account.collateral);
  const assets = Number(account.totalAssetValue);
  const values = [collateral, assets].filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  return values.length ? Math.max(...values) : 0;
}

export function applyAccountEquities(
  ranking: { whales: TrackerMetrics[]; highFrequency: TrackerMetrics[] },
  equities: Record<number, { collateral?: number; totalAssetValue?: number }>,
  limit = ranking.whales.length,
): { whales: TrackerMetrics[]; highFrequency: TrackerMetrics[] } {
  const whales = ranking.whales.map((account) => ({
    ...account,
    accountValue: accountEquity(equities[account.accountId] ?? {}),
  }));
  return {
    whales: whales
      .sort(
        (a, b) =>
          b.accountValue - a.accountValue ||
          b.observedNotional - a.observedNotional ||
          b.largestTrade - a.largestTrade,
      )
      .slice(0, Math.min(Math.max(Math.trunc(limit) || whales.length, 1), 100)),
    highFrequency: [],
  };
}

export function summarizeTrackedHistory(
  fills: HistoryFill[],
): TrackerHistorySummary {
  const metrics = createMetrics(0);
  for (const fill of fills) {
    addObservation(metrics, {
      notional: Math.abs(fill.usdAmount || fill.price * fill.size),
      symbol: fill.symbol || `#${fill.marketId}`,
      timestamp: fill.timestamp,
      role: fill.role,
      side: fill.side,
    });
  }
  const summary = finalizeMetrics(metrics);
  return {
    tradeCount: summary.tradeCount,
    makerTrades: summary.makerTrades,
    takerTrades: summary.takerTrades,
    buyTrades: summary.buyTrades,
    sellTrades: summary.sellTrades,
    observedNotional: summary.observedNotional,
    averageNotional: summary.averageNotional,
    largestTrade: summary.largestTrade,
    makerShare: summary.makerShare,
    buyShare: summary.buyShare,
    marketCount: summary.marketCount,
    symbols: summary.symbols,
    firstSeen: summary.firstSeen,
    lastSeen: summary.lastSeen,
    tradesPerMinute: summary.tradesPerMinute,
    accountValue: 0,
  };
}
