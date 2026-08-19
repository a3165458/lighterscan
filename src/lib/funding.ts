export type FundingVenue = "lighter" | "binance" | "bybit" | "hyperliquid";

export type CompareVenue = Exclude<FundingVenue, "lighter">;

export type MarketFunding = {
  marketId: number;
  symbol: string;
  lighter?: number;
  binance?: number;
  bybit?: number;
  hyperliquid?: number;
};

export type FundingHintSide = "short_lighter" | "long_lighter";

export type FundingBoardRow = MarketFunding & {
  lighter: number;
  lighterHourly: number;
  comps: Partial<Record<CompareVenue, number>>;
  hourly: Partial<Record<CompareVenue, number>>;
  vs: CompareVenue | null;
  spreadNative: number | null;
  spreadHourly: number | null;
  spreadAbs: number;
  hintSide: FundingHintSide | null;
  annualizedSpread: number | null;
};

const VENUES = new Set<FundingVenue>([
  "lighter",
  "binance",
  "bybit",
  "hyperliquid",
]);

export const COMPARE_VENUES: CompareVenue[] = [
  "hyperliquid",
  "binance",
  "bybit",
];

/**
 * RH `/funding-rates` stores an 8-hour-equivalent rate for every venue.
 * Binance matches official lastFundingRate (8h). Hyperliquid matches native
 * hourly × 8. Lighter sits on that same scale (e.g. HYPE). Bybit matches 8h
 * on BTC/ETH; other Bybit intervals may differ natively, but RH still emits
 * the comparison-scale number.
 */
export const RH_RATE_PERIOD_HOURS = 8;

/** Venues whose period is proven enough to show an annualized figure. */
export const ANNUALIZE_VENUES = new Set<FundingVenue>([
  "lighter",
  "binance",
  "hyperliquid",
]);

export function mapFundingRates(raw: unknown): MarketFunding[] {
  if (!Array.isArray(raw)) return [];
  const byMarket = new Map<number, MarketFunding>();
  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const rawId = row.market_id;
    if (rawId === undefined || rawId === null || rawId === "") continue;
    const marketId = Number(rawId);
    const symbol = String(row.symbol || "");
    const exchange = String(row.exchange || "").toLowerCase();
    const rate = Number(row.rate ?? 0);
    if (!Number.isFinite(marketId) || marketId < 0 || !symbol) continue;
    if (!VENUES.has(exchange as FundingVenue) || !Number.isFinite(rate)) continue;
    const current = byMarket.get(marketId) ?? {
      marketId,
      symbol,
    };
    current[exchange as FundingVenue] = rate;
    if (!current.symbol) current.symbol = symbol;
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

export function hasLighterFunding(
  row: MarketFunding | null | undefined,
): row is MarketFunding & { lighter: number } {
  return row != null && row.lighter != null && Number.isFinite(row.lighter);
}

export function hourlyFromRhRate(rate: number): number {
  return rate / RH_RATE_PERIOD_HOURS;
}

export function dailyFromRhRate(rate: number): number {
  return hourlyFromRhRate(rate) * 24;
}

export function annualizedFromRhRate(rate: number): number {
  return hourlyFromRhRate(rate) * 24 * 365;
}

export function compareVenues(
  row: MarketFunding,
): Partial<Record<CompareVenue, number>> {
  const comps: Partial<Record<CompareVenue, number>> = {};
  for (const venue of COMPARE_VENUES) {
    const rate = row[venue];
    if (rate != null && Number.isFinite(rate)) comps[venue] = rate;
  }
  return comps;
}

export function buildFundingBoardRow(
  row: MarketFunding & { lighter: number },
): FundingBoardRow {
  const comps = compareVenues(row);
  const hourly: Partial<Record<CompareVenue, number>> = {};
  for (const [venue, rate] of Object.entries(comps) as [CompareVenue, number][]) {
    hourly[venue] = hourlyFromRhRate(rate);
  }
  const lighterHourly = hourlyFromRhRate(row.lighter);

  let vs: CompareVenue | null = null;
  let spreadNative: number | null = null;
  let spreadHourly: number | null = null;
  let spreadAbs = 0;
  for (const venue of COMPARE_VENUES) {
    const other = hourly[venue];
    if (other == null) continue;
    const spread = lighterHourly - other;
    const abs = Math.abs(spread);
    if (abs >= spreadAbs) {
      spreadAbs = abs;
      spreadHourly = spread;
      spreadNative = row.lighter - (comps[venue] as number);
      vs = venue;
    }
  }

  let hintSide: FundingHintSide | null = null;
  if (vs != null && spreadHourly != null && spreadHourly !== 0) {
    hintSide = spreadHourly > 0 ? "short_lighter" : "long_lighter";
  }

  const annualizedSpread =
    vs != null &&
    spreadHourly != null &&
    ANNUALIZE_VENUES.has(vs) &&
    ANNUALIZE_VENUES.has("lighter")
      ? spreadHourly * 24 * 365
      : null;

  return {
    ...row,
    lighter: row.lighter,
    lighterHourly,
    comps,
    hourly,
    vs,
    spreadNative,
    spreadHourly,
    spreadAbs,
    hintSide,
    annualizedSpread,
  };
}

export function fundingBoardRows(rows: MarketFunding[]): FundingBoardRow[] {
  return rows
    .filter(hasLighterFunding)
    .map(buildFundingBoardRow)
    .sort((a, b) => b.spreadAbs - a.spreadAbs || a.symbol.localeCompare(b.symbol));
}
