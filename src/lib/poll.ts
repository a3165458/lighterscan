/** Header ticker. Totals do not need sub-10s freshness. */
export const TICKER_POLL_MS = 30_000;

/** Shared `/api/live` poll. Direct WebSocket tape is unchanged. */
export const LIVE_POLL_MS = 8_000;

export const TICKER_S_MAXAGE = TICKER_POLL_MS / 1_000;
export const LIVE_S_MAXAGE = LIVE_POLL_MS / 1_000;

export const TICKER_CACHE_CONTROL =
  `public, s-maxage=${TICKER_S_MAXAGE}, stale-while-revalidate=60`;
export const LIVE_CACHE_CONTROL =
  `public, s-maxage=${LIVE_S_MAXAGE}, stale-while-revalidate=24`;

/** Same query can be reused across tabs; keep short so new markets still appear. */
export const SEARCH_CACHE_CONTROL =
  "public, s-maxage=15, stale-while-revalidate=60";

/** Account history pages are query-specific; a short CDN window is enough. */
export const HISTORY_CACHE_CONTROL =
  "public, s-maxage=10, stale-while-revalidate=30";

export function isTabHidden(
  visibilityState: string | undefined | null,
): boolean {
  return visibilityState === "hidden";
}

/**
 * Delay until the next poll. Returns null when the tab is hidden so the
 * caller skips scheduling and waits for a visibilitychange instead.
 */
export function nextVisiblePollDelay(
  intervalMs: number,
  visibilityState: string | undefined | null,
): number | null {
  if (isTabHidden(visibilityState)) return null;
  return intervalMs;
}
