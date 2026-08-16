import assert from "node:assert/strict";
import test from "node:test";
import { requestFingerprint } from "./public-rate-limit.ts";

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
