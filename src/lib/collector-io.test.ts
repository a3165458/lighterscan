import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTOR_HEARTBEAT_MS,
  COLLECTOR_LEDGER_FLUSH_MS,
  COLLECTOR_PUBLISH_MS,
} from "./collector-io.ts";
import { LIVE_POLL_MS, TICKER_POLL_MS } from "./poll.ts";

test("collector publish is 10–20s and ledger writes are batched slower", () => {
  assert.ok(COLLECTOR_PUBLISH_MS >= 10_000);
  assert.ok(COLLECTOR_PUBLISH_MS <= 20_000);
  assert.ok(COLLECTOR_LEDGER_FLUSH_MS >= COLLECTOR_PUBLISH_MS);
  assert.ok(COLLECTOR_HEARTBEAT_MS >= COLLECTOR_PUBLISH_MS);
});

test("client poll rates stay at ticker 120s and live 20s", () => {
  assert.equal(TICKER_POLL_MS, 120_000);
  assert.equal(LIVE_POLL_MS, 20_000);
});
