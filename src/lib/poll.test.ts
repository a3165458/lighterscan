import assert from "node:assert/strict";
import test from "node:test";
import {
  LIVE_CACHE_CONTROL,
  LIVE_POLL_MS,
  LIVE_S_MAXAGE,
  TICKER_CACHE_CONTROL,
  TICKER_POLL_MS,
  TICKER_S_MAXAGE,
  isTabHidden,
  nextVisiblePollDelay,
} from "./poll.ts";

test("ticker and live cache windows match their poll intervals", () => {
  assert.equal(TICKER_POLL_MS, 30_000);
  assert.equal(LIVE_POLL_MS, 8_000);
  assert.equal(TICKER_S_MAXAGE, TICKER_POLL_MS / 1_000);
  assert.equal(LIVE_S_MAXAGE, LIVE_POLL_MS / 1_000);
  assert.equal(
    TICKER_CACHE_CONTROL,
    "public, s-maxage=30, stale-while-revalidate=60",
  );
  assert.equal(
    LIVE_CACHE_CONTROL,
    "public, s-maxage=8, stale-while-revalidate=24",
  );
});

test("isTabHidden treats only hidden as paused", () => {
  assert.equal(isTabHidden("hidden"), true);
  assert.equal(isTabHidden("visible"), false);
  assert.equal(isTabHidden("prerender"), false);
  assert.equal(isTabHidden(undefined), false);
  assert.equal(isTabHidden(null), false);
});

test("nextVisiblePollDelay skips scheduling while the tab is hidden", () => {
  assert.equal(nextVisiblePollDelay(TICKER_POLL_MS, "visible"), TICKER_POLL_MS);
  assert.equal(nextVisiblePollDelay(LIVE_POLL_MS, "hidden"), null);
  assert.equal(nextVisiblePollDelay(8_000, undefined), 8_000);
});
