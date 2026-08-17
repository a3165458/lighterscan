import assert from "node:assert/strict";
import test from "node:test";
import { filterTapeTrades, parseTapeMin } from "./tape-filter.ts";
import type { Trade } from "./types.ts";

function trade(partial: Partial<Trade> & Pick<Trade, "tradeId">): Trade {
  return {
    txHash: `hash-${partial.tradeId}`,
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
    ...partial,
  };
}

test("parseTapeMin accepts only known size floors", () => {
  assert.equal(parseTapeMin(undefined), 0);
  assert.equal(parseTapeMin("1000"), 1_000);
  assert.equal(parseTapeMin("5000"), 5_000);
  assert.equal(parseTapeMin("25000"), 25_000);
  assert.equal(parseTapeMin("100000"), 100_000);
  assert.equal(parseTapeMin("12"), 0);
});

test("filterTapeTrades applies notional floor and market allow-list", () => {
  const trades = [
    trade({ tradeId: "a", usdAmount: 900, symbol: "BTC" }),
    trade({ tradeId: "b", usdAmount: 1_500, symbol: "BTC" }),
    trade({ tradeId: "c", usdAmount: 9_000, symbol: "QQQ", marketId: 3 }),
  ];

  assert.deepEqual(
    filterTapeTrades(trades, { minUsd: 1_000 }).map((row) => row.tradeId),
    ["b", "c"],
  );
  assert.deepEqual(
    filterTapeTrades(trades, { minUsd: 1_000, markets: ["QQQ"] }).map(
      (row) => row.tradeId,
    ),
    ["c"],
  );
  assert.deepEqual(filterTapeTrades(trades, { minUsd: 50_000 }), []);
});
