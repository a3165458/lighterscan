import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateVolumeFromFills,
  mergeAccountStreamMessage,
  tradeLogHref,
} from "./account-stats.ts";

const NOW = Date.parse("2026-08-17T01:00:00.000Z");

test("aggregateVolumeFromFills splits 24h / 7d / all from explorer fills", () => {
  const stats = aggregateVolumeFromFills(
    [
      { timestamp: NOW - 2 * 60 * 60 * 1000, usdAmount: 100 },
      { timestamp: NOW - 3 * 24 * 60 * 60 * 1000, usdAmount: 250 },
      { timestamp: NOW - 20 * 24 * 60 * 60 * 1000, usdAmount: 400 },
      { timestamp: NOW - 2 * 60 * 60 * 1000, usdAmount: 0 },
    ],
    NOW,
  );

  assert.equal(stats.dailyTrades, 1);
  assert.equal(stats.dailyVolume, 100);
  assert.equal(stats.weeklyTrades, 2);
  assert.equal(stats.weeklyVolume, 350);
  assert.equal(stats.totalTrades, 3);
  assert.equal(stats.totalVolume, 750);
});

test("account 1441-style history with no fills in the last day is 24h zero, not empty", () => {
  const stats = aggregateVolumeFromFills(
    [
      { timestamp: Date.parse("2026-08-15T06:20:58.358Z"), usdAmount: 832.6 },
      { timestamp: Date.parse("2026-08-13T15:33:37.703Z"), usdAmount: 120 },
    ],
    NOW,
  );

  assert.equal(stats.dailyTrades, 0);
  assert.equal(stats.dailyVolume, 0);
  assert.equal(stats.weeklyTrades, 2);
  assert.equal(stats.totalTrades, 2);
  assert.ok(stats.weeklyVolume > 900);
});

test("mergeAccountStreamMessage reads volume from account_all and account_all_trades", () => {
  const fromAll = mergeAccountStreamMessage(
    {
      type: "update/account_all",
      daily_volume: "10",
      weekly_volume: 20,
      total_volume: 30,
      daily_trades_count: 1,
      weekly_trades_count: 2,
      total_trades_count: 3,
    },
    null,
  );
  assert.equal(fromAll.volumeFromStream, true);
  assert.deepEqual(fromAll.stats, {
    dailyVolume: 10,
    weeklyVolume: 20,
    monthlyVolume: 0,
    totalVolume: 30,
    dailyTrades: 1,
    weeklyTrades: 2,
    monthlyTrades: 0,
    totalTrades: 3,
  });

  const fromTrades = mergeAccountStreamMessage(
    {
      type: "subscribed/account_all_trades",
      channel: "account_all_trades:1441",
      total_volume: 99,
      total_trades_count: 4,
    },
    fromAll.stats,
  );
  assert.equal(fromTrades.stats?.totalVolume, 99);
  assert.equal(fromTrades.stats?.dailyVolume, 10);
});

test("mergeAccountStreamMessage does not zero history stats on empty frames", () => {
  const seeded = aggregateVolumeFromFills(
    [{ timestamp: NOW - 1000, usdAmount: 50 }],
    NOW,
  );
  assert.deepEqual(mergeAccountStreamMessage({ type: "ping" }, seeded), {
    stats: seeded,
    volumeFromStream: false,
  });
  assert.deepEqual(mergeAccountStreamMessage({ type: "update/account_all" }, seeded), {
    stats: seeded,
    volumeFromStream: false,
  });
});

test("tradeLogHref matches account history /logs destinations", () => {
  assert.equal(tradeLogHref(""), null);
  assert.equal(tradeLogHref("  "), null);
  assert.equal(
    tradeLogHref("c8b4136c2b410e79197199da6f29060b603508d36153eb7baedd8ab7631d7efc5012ffa9eb0fd44d"),
    "/logs/c8b4136c2b410e79197199da6f29060b603508d36153eb7baedd8ab7631d7efc5012ffa9eb0fd44d",
  );
});
