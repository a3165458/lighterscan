import assert from "node:assert/strict";
import test from "node:test";
import {
  isPrefetchRequest,
  localPublicRateLimit,
  requestFingerprint,
  resetPublicRateLimitForTests,
  settleRateLimit,
  shouldUseRemoteRateLimit,
} from "./public-rate-limit.ts";

test("requestFingerprint is stable without storing a raw client address", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.8, 10.0.0.1",
  });
  const first = requestFingerprint(headers, "test-secret");
  const second = requestFingerprint(headers, "test-secret");

  assert.equal(first, second);
  assert.equal(first.includes("203.0.113.8"), false);
});

test("requestFingerprint separates different clients", () => {
  const first = requestFingerprint(
    new Headers({ "x-forwarded-for": "203.0.113.8" }),
    "test-secret",
  );
  const second = requestFingerprint(
    new Headers({ "x-forwarded-for": "203.0.113.9" }),
    "test-secret",
  );

  assert.notEqual(first, second);
});

test("standard Redis and a tripped circuit use the in-memory limiter", () => {
  const now = 1_000;
  assert.equal(shouldUseRemoteRateLimit("tcp", now, 0), false);
  assert.equal(shouldUseRemoteRateLimit("none", now, 0), false);
  assert.equal(shouldUseRemoteRateLimit("upstash", now, 0), true);
  assert.equal(shouldUseRemoteRateLimit("upstash", now, now + 1), false);
});

test("logs scope uses a 60-request window like history", () => {
  resetPublicRateLimitForTests();
  const now = Date.now();
  const id = `logs-${now}`;
  let last = localPublicRateLimit("logs", id, now);
  for (let i = 1; i < 60; i += 1) {
    last = localPublicRateLimit("logs", id, now);
  }
  assert.equal(last.success, true);
  assert.equal(last.limit, 60);
  assert.equal(last.remaining, 0);
  const blocked = localPublicRateLimit("logs", id, now);
  assert.equal(blocked.success, false);
  resetPublicRateLimitForTests();
});

test("isPrefetchRequest ignores Next.js Link prefetch traffic", () => {
  assert.equal(
    isPrefetchRequest(new Headers({ "next-router-prefetch": "1" })),
    true,
  );
  assert.equal(
    isPrefetchRequest(new Headers({ purpose: "prefetch" })),
    true,
  );
  assert.equal(
    isPrefetchRequest(new Headers({ "user-agent": "curl" })),
    false,
  );
});

test("remote rate limit errors fall back to the in-memory window", async () => {
  resetPublicRateLimitForTests();
  const now = Date.now();
  const id = `alice-${now}`;
  const result = await settleRateLimit("search", id, now, async () => {
    throw new Error("max requests limit exceeded");
  });
  assert.equal(result.success, true);
  assert.equal(result.limit, 30);
  assert.equal(result.remaining, 29);
  const local = localPublicRateLimit("search", id, now);
  assert.equal(local.remaining, 28);
  resetPublicRateLimitForTests();
});
