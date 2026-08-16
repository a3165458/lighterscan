import { getMarkets } from "@/lib/rh";

const TRACKED_MARKET_COUNT = 6;

export type TrackedMarket = {
  marketId: number;
  symbol: string;
};

export async function getTrackedMarkets(): Promise<TrackedMarket[]> {
  const markets = await getMarkets();
  return markets
    .filter(
      (market) => market.marketType === "perp" && market.status === "active",
    )
    .slice(0, TRACKED_MARKET_COUNT)
    .map((market) => ({
      marketId: market.marketId,
      symbol: market.symbol,
    }));
}
