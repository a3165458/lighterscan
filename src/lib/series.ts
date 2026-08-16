import type { Candle } from "@/lib/types";

export function mergeHistoricalSeries(
  candles: Candle[] | null | undefined,
  hourlyPrices: number[] | null | undefined,
  now = Date.now(),
): Candle[] {
  const ohlc = (candles ?? []).filter(
    (c) =>
      c &&
      Number.isFinite(c.t) &&
      Number.isFinite(c.c) &&
      Number.isFinite(c.o),
  );
  if (ohlc.length >= 2) return ohlc;

  const prices = (hourlyPrices ?? []).filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length >= 2) {
    const last = prices.length - 1;
    return prices.map((price, i) => ({
      t: now - (last - i) * 3_600_000,
      o: price,
      h: price,
      l: price,
      c: price,
      v: 0,
      V: 0,
    }));
  }

  return ohlc.length === 1 ? ohlc : [];
}
