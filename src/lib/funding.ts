export type FundingVenue = "lighter" | "binance" | "bybit" | "hyperliquid";

export type MarketFunding = {
  marketId: number;
  symbol: string;
  lighter: number;
  binance?: number;
  bybit?: number;
  hyperliquid?: number;
};

const VENUES = new Set<FundingVenue>([
  "lighter",
  "binance",
  "bybit",
  "hyperliquid",
]);

export function mapFundingRates(raw: unknown): MarketFunding[] {
  if (!Array.isArray(raw)) return [];
  const byMarket = new Map<number, MarketFunding>();
  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const marketId = Number(row.market_id ?? 0);
    const symbol = String(row.symbol || "");
    const exchange = String(row.exchange || "").toLowerCase();
    const rate = Number(row.rate ?? 0);
    if (!Number.isFinite(marketId) || marketId <= 0 || !symbol) continue;
    if (!VENUES.has(exchange as FundingVenue) || !Number.isFinite(rate)) continue;
    const current = byMarket.get(marketId) ?? {
      marketId,
      symbol,
      lighter: 0,
    };
    current[exchange as FundingVenue] = rate;
    byMarket.set(marketId, current);
  }
  return [...byMarket.values()];
}

export function pickMarketFunding(
  rows: MarketFunding[],
  marketId: number,
): MarketFunding | null {
  return rows.find((row) => row.marketId === marketId) ?? null;
}
