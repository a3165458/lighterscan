import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSharedCacheBackend,
  resolveTcpRedisOptions,
} from "./shared-kv.ts";

test("REDIS_URL selects the standard TCP client over Upstash REST", () => {
  assert.equal(
    resolveSharedCacheBackend({
      REDIS_URL: "redis://redis.example.test:6379",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    }),
    "tcp",
  );
});

test("REDIS_HOST/PORT/PASSWORD selects TCP without REDIS_URL", () => {
  assert.equal(
    resolveSharedCacheBackend({
      REDIS_HOST: "redis.example.test",
      REDIS_PORT: "6380",
      REDIS_PASSWORD: "secret",
    }),
    "tcp",
  );
  assert.deepEqual(
    resolveTcpRedisOptions({
      REDIS_HOST: "redis.example.test",
      REDIS_PORT: "6380",
      REDIS_PASSWORD: "secret",
    }),
    {
      socket: { host: "redis.example.test", port: 6380 },
      password: "secret",
    },
  );
});

test("Upstash REST is used when only KV_REST_API_* is set", () => {
  assert.equal(
    resolveSharedCacheBackend({
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "token",
    }),
    "upstash",
  );
});

test("no redis credentials resolve to none", () => {
  assert.equal(resolveSharedCacheBackend({}), "none");
  assert.equal(resolveTcpRedisOptions({}), null);
});

test("REDIS_URL is preferred when both URL and HOST are set", () => {
  assert.deepEqual(
    resolveTcpRedisOptions({
      REDIS_URL: "redis://redis.example.test:6379",
      REDIS_HOST: "ignored.example.test",
    }),
    { url: "redis://redis.example.test:6379" },
  );
});
