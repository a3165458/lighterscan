import assert from "node:assert/strict";
import test from "node:test";
import {
  isLiquidationTrade,
  liquidationFromExplorerTrade,
  liquidationsFromTrades,
  mergeLiquidationRows,
} from "./liquidations.ts";
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

test("isLiquidationTrade matches official liquidation type names", () => {
  assert.equal(isLiquidationTrade(trade({ tradeId: "a" })), false);
  assert.equal(
    isLiquidationTrade(trade({ tradeId: "b", type: "liquidation" })),
    true,
  );
  assert.equal(
    isLiquidationTrade(trade({ tradeId: "c", type: "LiquidationTrade" })),
    true,
  );
  assert.equal(
    isLiquidationTrade(
      trade({ tradeId: "d", type: "liquidation_trade_with_funding" }),
    ),
    true,
  );
});

test("liquidationsFromTrades keeps only liquidation fills and sorts newest first", () => {
  const rows = liquidationsFromTrades([
    trade({ tradeId: "t1", timestamp: 3_000 }),
    trade({
      tradeId: "l1",
      type: "liquidation",
      timestamp: 1_000,
      usdAmount: 250,
      takerIsAsk: true,
      askAccountId: 77,
      bidAccountId: 88,
    }),
    trade({
      tradeId: "l2",
      type: "LiquidationTradeWithFunding",
      timestamp: 4_000,
      usdAmount: 80,
      symbol: "HYPE",
      marketId: 2,
    }),
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.tradeId, "l2");
  assert.equal(rows[0]?.symbol, "HYPE");
  assert.equal(rows[1]?.accountId, 77);
  assert.equal(rows[1]?.side, "short");
  assert.equal(
    liquidationsFromTrades(rows.map((row) => trade({ tradeId: row.tradeId }))).length,
    0,
  );
});

test("liquidationFromExplorerTrade maps a taker-ask liquidation", () => {
  const row = liquidationFromExplorerTrade({
    hash: "liq-hash",
    time: "",
    timestamp: 9,
    kind: "LiquidationTrade",
    txType: "L2Liquidation",
    blockNumber: 1,
    batchNumber: 1,
    status: "ok",
    marketId: 1,
    symbol: "BTC",
    price: 100,
    size: 0.5,
    usdAmount: 50,
    isTakerAsk: true,
    taker: "77",
    maker: "88",
    takerFee: 0,
    makerFee: 0,
  });
  assert.equal(row?.accountId, 77);
  assert.equal(row?.side, "short");
  assert.equal(row?.usdAmount, 50);
  assert.equal(
    liquidationFromExplorerTrade({
      hash: "x",
      time: "",
      timestamp: 1,
      kind: "Trade",
      txType: "L2Trade",
      blockNumber: 1,
      batchNumber: 1,
      status: "ok",
      marketId: 1,
      price: 1,
      size: 1,
      usdAmount: 1,
      isTakerAsk: false,
      taker: "1",
      maker: "2",
      takerFee: 0,
      makerFee: 0,
    }),
    null,
  );
});

test("mergeLiquidationRows de-dupes and keeps newest first", () => {
  const older = liquidationsFromTrades([
    trade({ tradeId: "same", type: "liquidation", timestamp: 1 }),
  ]);
  const newer = liquidationsFromTrades([
    trade({ tradeId: "same", type: "liquidation", timestamp: 1 }),
    trade({ tradeId: "newer", type: "liquidation", timestamp: 5, marketId: 2 }),
  ]);
  const merged = mergeLiquidationRows(older, newer);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.tradeId, "newer");
});
