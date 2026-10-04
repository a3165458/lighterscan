import { cached, ISR_PAGE_CACHE } from "@/lib/cache";
import { getAccountExplorerLogs, getRecentExplorerLiquidations } from "@/lib/history";
import { describeExplorerLog, type ExplorerTrade } from "@/lib/history-map";
import {
  mergeLiquidationRows,
  type LiquidationRow,
} from "@/lib/liquidations";
import { rankOpenPositions, type RankedPosition } from "@/lib/realtime";
import {
  getAccountByIndex,
  getCandles,
  getRecentTrades,
} from "@/lib/rh";
import { hourlyQuoteVolume, sumHourlyVolumes, type HourlyVolume } from "@/lib/series";
import {
  collectActiveAccountIds,
  isPublicUserAccount,
  PUBLIC_POOL_ACCOUNT_INDEX,
} from "@/lib/tracker-metrics";
import type { AccountPosition, Market, Trade } from "@/lib/types";

const POSITION_MARKET_LIMIT = 4;
const POSITION_ACCOUNT_LIMIT = 6;
const VOLUME_MARKET_LIMIT = 5;

function perpMarkets(markets: Market[], limit: number): Market[] {
  return markets
    .filter((market) => market.marketType === "perp" && market.marketId > 0)
    .slice(0, limit);
}

function marketNames(markets: Market[]): Record<number, string> {
  return Object.fromEntries(markets.map((market) => [market.marketId, market.symbol]));
}

const POOL_TRADE_TYPES = [
  "Trade",
  "TradeWithFunding",
  "LiquidationTrade",
  "LiquidationTradeWithFunding",
];

function tapeTradeFromExplorer(trade: ExplorerTrade): Trade {
  const taker = Number(trade.taker);
  const maker = Number(trade.maker);
  const askAccountId = trade.isTakerAsk ? taker : maker;
  const bidAccountId = trade.isTakerAsk ? maker : taker;
  return {
    tradeId: trade.hash,
    txHash: trade.hash,
    type: trade.kind,
    marketId: trade.marketId,
    symbol: trade.symbol,
    size: trade.size,
    price: trade.price,
    usdAmount: trade.usdAmount,
    askAccountId: Number.isFinite(askAccountId) ? askAccountId : 0,
    bidAccountId: Number.isFinite(bidAccountId) ? bidAccountId : 0,
    isMakerAsk: !trade.isTakerAsk,
    timestamp: trade.timestamp,
    takerIsAsk: trade.isTakerAsk,
  };
}

/** Pool fills for `/pool`. Explorer + Next Data Cache; never shared KV. */
export async function loadPublicPoolTrades(
  marketNamesById: Record<number, string> = {},
): Promise<Trade[]> {
  return cached(
    "public:pool-trades",
    20_000,
    async () => {
      const logs = await getAccountExplorerLogs(
        PUBLIC_POOL_ACCOUNT_INDEX,
        POOL_TRADE_TYPES,
        40,
      ).catch(() => []);
      const trades: Trade[] = [];
      for (const raw of logs) {
        const trade = describeExplorerLog(raw, marketNamesById);
        if (!trade) continue;
        trades.push(tapeTradeFromExplorer(trade));
      }
      trades.sort((a, b) => b.timestamp - a.timestamp);
      return trades.slice(0, 40);
    },
    ISR_PAGE_CACHE,
  );
}

export async function loadPublicLiquidations(
  markets: Market[],
): Promise<LiquidationRow[]> {
  return cached(
    "public:liquidations",
    20_000,
    async () => {
      const names = marketNames(markets);
      const explorerRows = await getRecentExplorerLiquidations(names).catch(
        () => [],
      );
      return mergeLiquidationRows(explorerRows).slice(0, 80);
    },
    ISR_PAGE_CACHE,
  );
}

async function loadAccountPositions(
  accountId: number,
): Promise<AccountPosition[]> {
  try {
    const bundle = await getAccountByIndex(accountId);
    return bundle.primary.positions.filter((position) => position.position !== 0);
  } catch {
    return [];
  }
}

function rankLoadedPositions(
  byAccount: Record<number, AccountPosition[]>,
): RankedPosition[] {
  return rankOpenPositions(
    byAccount,
    50,
    (accountId) =>
      isPublicUserAccount(accountId) || accountId === PUBLIC_POOL_ACCOUNT_INDEX,
  );
}

export async function loadPublicPositions(
  markets: Market[],
): Promise<RankedPosition[]> {
  return cached("public:positions:v2", 45_000, async () => {
    const byAccount: Record<number, AccountPosition[]> = {};
    const pool = await loadAccountPositions(PUBLIC_POOL_ACCOUNT_INDEX);
    if (pool.length) byAccount[PUBLIC_POOL_ACCOUNT_INDEX] = pool;
    const ranked = rankLoadedPositions(byAccount);
    if (ranked.length >= 12) return ranked;

    const top = perpMarkets(markets, POSITION_MARKET_LIMIT);
    const tradeLists = await Promise.all(
      top.map((market) =>
        getRecentTrades(market.marketId, 20, { symbol: market.symbol }).catch(
          () => [],
        ),
      ),
    );
    const extraIds = collectActiveAccountIds(
      tradeLists.flat(),
      POSITION_ACCOUNT_LIMIT,
    );
    await Promise.all(
      extraIds.map(async (accountId) => {
        const open = await loadAccountPositions(accountId);
        if (open.length) byAccount[accountId] = open;
      }),
    );
    return rankLoadedPositions(byAccount);
  }, ISR_PAGE_CACHE);
}

export async function loadPublicHourlyVolume(
  markets: Market[],
): Promise<HourlyVolume[]> {
  return cached("public:hourly-volume:v2", 45_000, async () => {
    const top = perpMarkets(markets, VOLUME_MARKET_LIMIT);
    const series = await Promise.all(
      top.map((market) =>
        getCandles(market.marketId, "1h", 24)
          .then(hourlyQuoteVolume)
          .catch(() => []),
      ),
    );
    return sumHourlyVolumes(series).slice(-24);
  }, ISR_PAGE_CACHE);
}
