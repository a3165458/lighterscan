import type { Trade } from "./types.ts";

export const TAPE_MIN_OPTIONS = [0, 1_000, 5_000, 25_000, 100_000] as const;

export type TapeMin = (typeof TAPE_MIN_OPTIONS)[number];

export function parseTapeMin(raw: string | undefined | null): TapeMin {
  const value = Number(raw);
  return TAPE_MIN_OPTIONS.includes(value as TapeMin) ? (value as TapeMin) : 0;
}

export function filterTapeTrades(
  trades: Trade[],
  options: { minUsd?: number; markets?: string[] } = {},
): Trade[] {
  const minUsd = options.minUsd ?? 0;
  const allowed = options.markets?.length
    ? new Set(options.markets.map((symbol) => symbol.toUpperCase()))
    : null;
  return trades.filter((trade) => {
    if (trade.usdAmount < minUsd) return false;
    if (!allowed) return true;
    return allowed.has((trade.symbol || String(trade.marketId)).toUpperCase());
  });
}
