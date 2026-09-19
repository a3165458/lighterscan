import assert from "node:assert/strict";
import test from "node:test";
import { cached, memoryCacheSize, resolveCachedOptions } from "./cache.ts";
import {
  resetSharedKvForTests,
  setSharedKvForTests,
} from "./shared-kv.ts";

test("cached returns the producer value and reuses it inside TTL", async () => {
  let calls = 0;
  const key = `t-${Date.now()}-a`;
  const first = await cached(key, 60_000, async () => {
    calls += 1;
    return { n: 7 };
  });
  const second = await cached(key, 60_000, async () => {
    calls += 1;
    return { n: 8 };
  });
  assert.equal(first.n, 7);
  assert.equal(second.n, 7);
  assert.equal(calls, 1);
  assert.ok(memoryCacheSize() >= 1);
});

test("cached serves stale value when the producer fails", async () => {
  const key = `t-${Date.now()}-stale`;
  const first = await cached(key, 1, async () => "fresh", 60_000);
  assert.equal(first, "fresh");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const stale = await cached(
    key,
    1,
    async () => {
      throw new Error("upstream 429");
    },
    60_000,
  );
  assert.equal(stale, "fresh");
});

test("cached coalesces concurrent lookups onto one producer", async () => {
  let calls = 0;
  const key = `t-${Date.now()}-b`;
  const [a, b] = await Promise.all([
    cached(key, 60_000, async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return 11;
    }),
    cached(key, 60_000, async () => {
      calls += 1;
      return 12;
    }),
  ]);
  assert.equal(a, 11);
  assert.equal(b, 11);
  assert.equal(calls, 1);
});

test("resolveCachedOptions keeps the numeric staleMs overload", () => {
  assert.deepEqual(resolveCachedOptions(7_000), {
    staleMs: 7_000,
    shared: true,
  });
  assert.deepEqual(resolveCachedOptions({ staleMs: 9_000, shared: false }), {
    staleMs: 9_000,
    shared: false,
  });
  assert.deepEqual(resolveCachedOptions(), {
    staleMs: 10 * 60_000,
    shared: true,
  });
});

test("cached with shared:false never reads or writes Redis/KV", async () => {
  let gets = 0;
  let sets = 0;
  setSharedKvForTests({
    async get() {
      gets += 1;
      return "from-kv" as never;
    },
    async set() {
      sets += 1;
    },
  });
  const key = `t-${Date.now()}-local-only`;
  const value = await cached(key, 60_000, async () => "produced", {
    shared: false,
  });
  assert.equal(value, "produced");
  assert.equal(gets, 0);
  assert.equal(sets, 0);
  resetSharedKvForTests();
});

test("cached with shared:true still write-through to Redis/KV", async () => {
  let gets = 0;
  let sets = 0;
  const written: unknown[] = [];
  setSharedKvForTests({
    async get() {
      gets += 1;
      return null;
    },
    async set(_key, value) {
      sets += 1;
      written.push(value);
    },
  });
  const key = `t-${Date.now()}-shared`;
  const value = await cached(key, 60_000, async () => "produced");
  assert.equal(value, "produced");
  assert.equal(gets, 1);
  assert.equal(sets, 1);
  assert.deepEqual(written, ["produced"]);
  resetSharedKvForTests();
});

test("cached shared:false still serves stale after an upstream failure", async () => {
  const key = `t-${Date.now()}-local-stale`;
  const first = await cached(key, 1, async () => "fresh", {
    staleMs: 60_000,
    shared: false,
  });
  assert.equal(first, "fresh");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const stale = await cached(
    key,
    1,
    async () => {
      throw new Error("upstream 429");
    },
    { staleMs: 60_000, shared: false },
  );
  assert.equal(stale, "fresh");
});
