import assert from "node:assert/strict";
import test from "node:test";
import { canLinkAddress, isAddress, isRedactedAddress } from "./format.ts";
import { resolveLiveStatus } from "./live-status.ts";
import { mergeHistoricalSeries } from "./series.ts";
import type { Candle } from "./types.ts";

const candle = (t: number, c: number): Candle => ({
  t,
  o: c,
  h: c + 1,
  l: c - 1,
  c,
  v: 1,
  V: 10,
});

test("OHLC candles win when at least two points exist", () => {
  const candles = [candle(1, 10), candle(2, 11), candle(3, 12)];
  const merged = mergeHistoricalSeries(candles, [99, 100, 101], 0);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].c, 10);
  assert.equal(merged[2].h, 13);
});

test("hourly price-chart fallback produces a multi-point series", () => {
  const merged = mergeHistoricalSeries([], [100, 101, 102.5], 3_600_000 * 10);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].c, 100);
  assert.equal(merged[2].c, 102.5);
  assert.ok(merged[2].t > merged[0].t);
});

test("empty candles and empty hourly prices stay empty", () => {
  assert.deepEqual(mergeHistoricalSeries([], [], 0), []);
  assert.deepEqual(mergeHistoricalSeries(undefined, undefined, 0), []);
});

test("visible fills force Live instead of Connecting", () => {
  assert.equal(resolveLiveStatus("connecting", true), "live");
  assert.equal(resolveLiveStatus("connecting", false), "connecting");
  assert.equal(resolveLiveStatus("idle", false), "idle");
});

test("redacted leaderboard addresses are not linkable wallets", () => {
  const starred = "0x9C**************************************";
  assert.equal(isAddress(starred), false);
  assert.equal(isRedactedAddress(starred), true);
  assert.equal(canLinkAddress(starred), false);
  assert.equal(canLinkAddress("0x0000000000000000000000000000000000000001"), true);
});
