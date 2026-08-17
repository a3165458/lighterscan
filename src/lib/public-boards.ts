import { cached } from "@/lib/cache";
import { getRecentExplorerLiquidations } from "@/lib/history";
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
import type { AccountPosition, Market } from "@/lib/types";

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

export async function loadPublicLiquidations(
  markets: Market[],
): Promise<LiquidationRow[]> {
  return cached("public:liquidations", 20_000, async () => {
    const names = marketNames(markets);
    const explorerRows = await getRecentExplorerLiquidations(names).catch(
      () => [],
    );
    return mergeLiquidationRows(explorerRows).slice(0, 80);
  });
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
  });
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
  });
}
