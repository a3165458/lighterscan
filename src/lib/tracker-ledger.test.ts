import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_TRACKER_BUCKET,
  applyEquitiesToLedger,
  applyTradesToLedger,
  emptyTrackerLedger,
  ledgerBucketToSample,
} from "./tracker-ledger.ts";
import type { Trade } from "./types.ts";

function trade(
  partial: Partial<Trade> & Pick<Trade, "tradeId" | "symbol" | "askAccountId" | "bidAccountId">,
): Trade {
  return {
    txHash: `hash-${partial.tradeId}`,
    type: "trade",
    marketId: partial.symbol === "ETH" ? 2 : 1,
    size: 1,
    price: 100,
    usdAmount: 100,
    isMakerAsk: true,
    timestamp: 1_000,
    takerIsAsk: false,
    ...partial,
  };
}

test("applyTradesToLedger accumulates all-time stats and ignores duplicates", () => {
  let ledger = emptyTrackerLedger(0);
  const first = applyTradesToLedger(
    ledger,
    [
      trade({ tradeId: "a", symbol: "BTC", askAccountId: 1, bidAccountId: 2, timestamp: 1_000 }),
      trade({ tradeId: "b", symbol: "ETH", askAccountId: 1, bidAccountId: 3, timestamp: 5_000 }),
    ],
    10,
  );
  assert.equal(first.applied, 2);
  const again = applyTradesToLedger(
    first.ledger,
    [trade({ tradeId: "a", symbol: "BTC", askAccountId: 1, bidAccountId: 2, timestamp: 1_000 })],
    11,
  );
  assert.equal(again.applied, 0);
  const all = ledgerBucketToSample(again.ledger, ALL_TRACKER_BUCKET, 10);
  assert.equal(all.sampledTrades, 2);
  assert.equal(all.windowStart, 1_000);
  assert.equal(all.windowEnd, 5_000);
  assert.equal(all.whales.find((row) => row.accountId === 1)?.tradeCount, 2);
  const btc = ledgerBucketToSample(again.ledger, "BTC", 10);
  assert.equal(btc.sampledTrades, 1);
  assert.equal(btc.whales.find((row) => row.accountId === 1)?.tradeCount, 1);
  assert.deepEqual(btc.markets, ["BTC"]);
});

test("applyTradesToLedger keeps untouched accounts when applying later fills", () => {
  const ledger = emptyTrackerLedger(0);
  applyTradesToLedger(
    ledger,
    [trade({ tradeId: "a", symbol: "BTC", askAccountId: 1, bidAccountId: 2 })],
    1,
  );
  applyTradesToLedger(
    ledger,
    [trade({ tradeId: "c", symbol: "BTC", askAccountId: 3, bidAccountId: 4, timestamp: 9_000 })],
    2,
  );
  const all = ledgerBucketToSample(ledger, ALL_TRACKER_BUCKET, 10);
  assert.equal(all.sampledTrades, 2);
  assert.equal(all.whales.length, 4);
  assert.equal(all.whales.find((row) => row.accountId === 1)?.tradeCount, 1);
});

test("applyEquitiesToLedger writes official values onto stored accounts", () => {
  const ledger = emptyTrackerLedger(0);
  applyTradesToLedger(
    ledger,
    [trade({ tradeId: "a", symbol: "BTC", askAccountId: 1, bidAccountId: 2 })],
    1,
  );
  applyEquitiesToLedger(ledger, {
    1: { collateral: 80, totalAssetValue: 250 },
    9: 1_000,
  });
  const all = ledgerBucketToSample(ledger, ALL_TRACKER_BUCKET, 10);
  assert.equal(all.whales[0].accountId, 1);
  assert.equal(all.whales[0].accountValue, 250);
  assert.equal(all.whales.find((row) => row.accountId === 2)?.accountValue, 0);
});
