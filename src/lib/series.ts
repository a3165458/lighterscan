import { normalizeTs } from "./format.ts";
import type { Candle } from "./types.ts";

export type HourlyVolume = {
  t: number;
  volume: number;
};

export function candleQuoteVolume(candle: Pick<Candle, "c" | "v" | "V">): number {
  if (Number.isFinite(candle.V) && candle.V > 0) return candle.V;
  if (Number.isFinite(candle.v) && candle.v > 0 && Number.isFinite(candle.c)) {
    return candle.v * candle.c;
  }
  return 0;
}

export function hourlyQuoteVolume(candles: Candle[]): HourlyVolume[] {
  const byHour = new Map<number, number>();
  for (const candle of candles) {
    if (!candle || !Number.isFinite(candle.t)) continue;
    const hour = Math.floor(normalizeTs(candle.t) / 3_600_000) * 3_600_000;
    byHour.set(hour, (byHour.get(hour) ?? 0) + candleQuoteVolume(candle));
  }
  return [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, volume]) => ({ t, volume }));
}

export function sumHourlyVolumes(series: HourlyVolume[][]): HourlyVolume[] {
  const byHour = new Map<number, number>();
  for (const rows of series) {
    for (const row of rows) {
      if (!row || !Number.isFinite(row.t) || !Number.isFinite(row.volume)) continue;
      byHour.set(row.t, (byHour.get(row.t) ?? 0) + row.volume);
    }
  }
  return [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, volume]) => ({ t, volume }));
}

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
