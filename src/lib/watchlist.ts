export const WATCHLIST_KEY = "ls-watch";

export function readWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WATCHLIST_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeWatchlist(symbols: string[]): string[] {
  const next = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
  return next;
}

export function toggleWatchlist(symbol: string): string[] {
  const key = symbol.toUpperCase();
  const current = readWatchlist();
  return writeWatchlist(
    current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
  );
}
