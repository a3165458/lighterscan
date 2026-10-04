import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { ISR_PAGE_CACHE } from "./cache.ts";
import { getAccountFundHistory } from "./funds.ts";
import { getAccountTradeHistory, getAccountVolumeStats } from "./history.ts";
import {
  loadPublicHourlyVolume,
  loadPublicLiquidations,
  loadPublicPoolTrades,
  loadPublicPositions,
} from "./public-boards.ts";
import { publicRealtimeTransport } from "./shared-cache.ts";
import {
  resetSharedKvForTests,
  setSharedKvForTests,
} from "./shared-kv.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));

const ISR_PAGES = [
  "src/app/page.tsx",
  "src/app/pool/page.tsx",
  "src/app/positions/page.tsx",
  "src/app/liquidations/page.tsx",
  "src/app/stats/page.tsx",
  "src/app/funding/page.tsx",
  "src/app/tape/page.tsx",
  "src/app/trackers/page.tsx",
  "src/app/leaderboard/page.tsx",
  "src/app/markets/[symbol]/page.tsx",
  "src/app/logs/[hash]/page.tsx",
  "src/app/address/[addr]/page.tsx",
  "src/app/account/[id]/page.tsx",
];

function pageSource(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("ISR pages stay off shared KV", { concurrency: 1 }, () => {
  test("revalidate pages do not call shared snapshot readers", () => {
    const forbidden = [
      "readPublicRealtimeSnapshot",
      "readHourlyStats",
      "readTrackerLedger",
      "getSharedKv",
      "getSharedRedis",
    ];
    for (const page of ISR_PAGES) {
      const source = pageSource(page);
      for (const name of forbidden) {
        assert.equal(source.includes(name), false, `${page} references ${name}`);
      }
    }
    assert.match(pageSource("src/app/pool/page.tsx"), /loadPublicPoolTrades/);
    assert.match(pageSource("src/app/address/[addr]/page.tsx"), /isr:\s*true/);
    assert.match(pageSource("src/app/account/[id]/page.tsx"), /isr:\s*true/);
    assert.doesNotMatch(pageSource("src/app/api/history/route.ts"), /isr:\s*true/);
    assert.doesNotMatch(pageSource("src/app/api/funds/route.ts"), /isr:\s*true/);
  });

  test("pool and board loaders use shared:false and never touch Redis/KV", async () => {
    assert.equal(ISR_PAGE_CACHE.shared, false);
    let gets = 0;
    let sets = 0;
    setSharedKvForTests({
      async get() {
        gets += 1;
        return null;
      },
      async set() {
        sets += 1;
      },
    });
    const previous = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    try {
      publicRealtimeTransport();
      const [pool, liquidations, positions, hours] = await Promise.all([
        loadPublicPoolTrades({ 1: "BTC" }),
        loadPublicLiquidations([]),
        loadPublicPositions([]),
        loadPublicHourlyVolume([]),
      ]);
      assert.deepEqual(pool, []);
      assert.deepEqual(liquidations, []);
      assert.deepEqual(positions, []);
      assert.deepEqual(hours, []);
      await assert.rejects(
        () => getAccountTradeHistory("9001", 0, 5, ["9001"], {}, { isr: true }),
        /offline/,
      );
      await assert.rejects(
        () => getAccountFundHistory("9001", 0, 5, ["9001"], { isr: true }),
        /offline/,
      );
      await assert.rejects(
        () => getAccountVolumeStats("9001", ["9001"], 1_000, { isr: true }),
        /offline/,
      );
    } finally {
      globalThis.fetch = previous;
      resetSharedKvForTests();
    }
    assert.equal(gets, 0);
    assert.equal(sets, 0);
  });

  test("public history and fund APIs still consult Redis/KV", async () => {
    let gets = 0;
    let sets = 0;
    setSharedKvForTests({
      async get() {
        gets += 1;
        return null;
      },
      async set() {
        sets += 1;
      },
    });
    const previous = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    try {
      await assert.rejects(
        () => getAccountTradeHistory("9002", 0, 5),
        /offline/,
      );
      assert.equal(gets, 1);
      assert.equal(sets, 0);
      gets = 0;
      await assert.rejects(
        () => getAccountFundHistory("9003", 0, 5),
        /offline/,
      );
      assert.equal(gets, 1);
      assert.equal(sets, 0);
    } finally {
      globalThis.fetch = previous;
      resetSharedKvForTests();
    }
  });
});
