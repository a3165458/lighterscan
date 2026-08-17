export type MarketChoice = {
  marketId: number;
  symbol: string;
};

export function normalizeMarketKey(value: string): string {
  return value.trim().toUpperCase();
}

export function perpChoices(
  markets: Array<{ marketId: number; symbol: string; marketType?: string }>,
  limit = 80,
): MarketChoice[] {
  return markets
    .filter((market) => (market.marketType ?? "perp") === "perp" && market.marketId > 0)
    .slice(0, Math.min(Math.max(limit, 1), 120))
    .map((market) => ({ marketId: market.marketId, symbol: market.symbol }));
}

export function resolveMarketChoice(
  raw: string | undefined | null,
  markets: MarketChoice[],
): MarketChoice | null {
  if (!raw || !markets.length) return null;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  if (!value) return null;
  const key = normalizeMarketKey(value);
  return (
    markets.find((market) => normalizeMarketKey(market.symbol) === key) ||
    markets.find(
      (market) => normalizeMarketKey(market.symbol.split("/")[0]) === key,
    ) ||
    markets.find((market) => String(market.marketId) === value) ||
    null
  );
}

export function matchesMarket(
  selected: MarketChoice | null,
  symbol?: string,
  marketId?: number,
): boolean {
  if (!selected) return true;
  if (marketId != null && marketId === selected.marketId) return true;
  if (symbol && normalizeMarketKey(symbol) === normalizeMarketKey(selected.symbol)) {
    return true;
  }
  if (symbol && normalizeMarketKey(symbol.split("/")[0]) === normalizeMarketKey(selected.symbol)) {
    return true;
  }
  return false;
}

export function filterByMarket<T>(
  rows: T[],
  selected: MarketChoice | null,
  pick: (row: T) => { symbol?: string; marketId?: number },
): T[] {
  if (!selected) return rows;
  return rows.filter((row) => {
    const item = pick(row);
    return matchesMarket(selected, item.symbol, item.marketId);
  });
}
