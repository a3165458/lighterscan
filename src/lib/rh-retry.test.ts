import assert from "node:assert/strict";
import test from "node:test";
import { retryDelayMs } from "./rh-retry.ts";

test("retryDelayMs applies exponential backoff when Retry-After is absent", () => {
  assert.equal(retryDelayMs(null, 0, 0), 1_000);
  assert.equal(retryDelayMs(null, 1, 0), 2_000);
  assert.equal(retryDelayMs(null, 4, 0), 8_000);
});

test("retryDelayMs honors Retry-After seconds", () => {
  assert.equal(retryDelayMs("3", 0, 0), 3_000);
});

test("retryDelayMs honors Retry-After HTTP dates", () => {
  assert.equal(
    retryDelayMs("Thu, 01 Jan 1970 00:00:05 GMT", 0, 1_000),
    4_000,
  );
});
