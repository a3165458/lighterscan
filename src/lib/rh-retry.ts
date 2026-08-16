const MAX_RETRY_DELAY_MS = 30_000;
const MAX_EXPONENTIAL_DELAY_MS = 8_000;

export function retryDelayMs(
  retryAfter: string | null,
  attempt: number,
  now = Date.now(),
): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(
        MAX_RETRY_DELAY_MS,
        Math.max(1_000, seconds * 1_000),
      );
    }
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt) && retryAt > now) {
      return Math.min(MAX_RETRY_DELAY_MS, retryAt - now);
    }
  }
  return Math.min(
    MAX_EXPONENTIAL_DELAY_MS,
    1_000 * 2 ** Math.max(0, attempt),
  );
}
