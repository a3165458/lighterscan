import assert from "node:assert/strict";
import test from "node:test";
import { LIVE_POLL_MS } from "./poll.ts";
import { buildPublicRealtimeSnapshot } from "./realtime.ts";
import {
  expireSnapshotMemoForTests,
  readPublicRealtimeSnapshot,
  resetSharedKvForTests,
  resetSnapshotMemoForTests,
  setSharedKvForTests,
  SNAPSHOT_MEMO_MS,
} from "./shared-cache.ts";
import type { SharedKv } from "./shared-kv.ts";
import type { Trade } from "./types.ts";

const trade: Trade = {
  tradeId: "trade-1",
  txHash: "hash-1",
  type: "trade",
  marketId: 1,
  symbol: "BTC",
  size: 1,
  price: 100,
  usdAmount: 100,
  askAccountId: 10,
  bidAccountId: 20,
  isMakerAsk: true,
  timestamp: 1_000,
  takerIsAsk: false,
};

const snapshot = buildPublicRealtimeSnapshot(
  [trade],
  [{ marketId: 1, symbol: "BTC" }],
  3_000,
);

function fakeKv(store: Map<string, unknown>, onGet?: () => void): SharedKv {
  return {
    async get<T>(key: string) {
      onGet?.();
      return (store.get(key) as T | undefined) ?? null;
    },
    async set(key: string, value: unknown) {
      store.set(key, value);
    },
  };
}

test("snapshot memo TTL matches the 60s live poll", () => {
  assert.equal(SNAPSHOT_MEMO_MS, 60_000);
  assert.equal(SNAPSHOT_MEMO_MS, LIVE_POLL_MS);
});

test("readPublicRealtimeSnapshot memos and coalesces in-flight Redis reads", async () => {
  resetSharedKvForTests();
  resetSnapshotMemoForTests();
  let gets = 0;
  const store = new Map<string, unknown>([
    ["lighterscan:public-realtime:v1", snapshot],
  ]);
  setSharedKvForTests(
    fakeKv(store, () => {
      gets += 1;
    }),
  );

  const [first, second] = await Promise.all([
    readPublicRealtimeSnapshot(),
    readPublicRealtimeSnapshot(),
  ]);
  const third = await readPublicRealtimeSnapshot();

  assert.equal(gets, 1);
  assert.equal(first?.updatedAt, 3_000);
  assert.equal(second?.updatedAt, 3_000);
  assert.equal(third?.updatedAt, 3_000);
  resetSharedKvForTests();
  resetSnapshotMemoForTests();
});

test("readPublicRealtimeSnapshot soft-fails when Redis throws", async () => {
  resetSharedKvForTests();
  resetSnapshotMemoForTests();
  setSharedKvForTests({
    async get() {
      throw new Error("max requests limit exceeded");
    },
    async set() {
      throw new Error("max requests limit exceeded");
    },
  });

  assert.equal(await readPublicRealtimeSnapshot(), null);
  resetSharedKvForTests();
  resetSnapshotMemoForTests();
});

test("readPublicRealtimeSnapshot keeps the last memo after Redis starts failing", async () => {
  resetSharedKvForTests();
  resetSnapshotMemoForTests();
  const store = new Map<string, unknown>([
    ["lighterscan:public-realtime:v1", snapshot],
  ]);
  let fail = false;
  setSharedKvForTests({
    async get<T>(key: string) {
      if (fail) throw new Error("max requests limit exceeded");
      return (store.get(key) as T | undefined) ?? null;
    },
    async set() {},
  });
  const primed = await readPublicRealtimeSnapshot();
  expireSnapshotMemoForTests();
  fail = true;
  const after = await readPublicRealtimeSnapshot();
  assert.equal(primed?.updatedAt, 3_000);
  assert.equal(after?.updatedAt, 3_000);
  resetSharedKvForTests();
  resetSnapshotMemoForTests();
});
