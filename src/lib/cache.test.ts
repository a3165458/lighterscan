import assert from "node:assert/strict";
import test from "node:test";
import { cached, memoryCacheSize } from "./cache.ts";

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
