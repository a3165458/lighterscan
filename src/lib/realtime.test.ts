import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicRealtimeSnapshot,
  isPublicRealtimeSnapshot,
  isRealtimeSnapshotFresh,
  parseLighterTradeMessage,
} from "./realtime.ts";
import type { Trade } from "./types.ts";

const trade: Trade = {
  tradeId: "trade-1",
  txHash: "hash-1",
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
};

test("buildPublicRealtimeSnapshot publishes trades and account rankings", () => {
  const snapshot = buildPublicRealtimeSnapshot(
    [trade, { ...trade, tradeId: "trade-2", txHash: "hash-2", timestamp: 2_000 }],
    [{ marketId: 1, symbol: "BTC" }],
    3_000,
  );

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.updatedAt, 3_000);
  assert.equal(snapshot.trades.length, 2);
  assert.equal(snapshot.trackers.sampledTrades, 2);
  assert.equal(snapshot.trackers.whales[0].accountId, 10);
  assert.deepEqual(snapshot.trackers.markets, ["BTC"]);
});

test("isPublicRealtimeSnapshot rejects malformed cache values", () => {
  assert.equal(isPublicRealtimeSnapshot({ version: 1, trades: [] }), false);
  assert.equal(
    isPublicRealtimeSnapshot(
      buildPublicRealtimeSnapshot([trade], [{ marketId: 1, symbol: "BTC" }], 3_000),
    ),
    true,
  );
});

test("isRealtimeSnapshotFresh enforces the public stale window", () => {
  const snapshot = buildPublicRealtimeSnapshot(
    [trade],
    [{ marketId: 1, symbol: "BTC" }],
    3_000,
  );

  assert.equal(isRealtimeSnapshotFresh(snapshot, 12_000), true);
  assert.equal(isRealtimeSnapshotFresh(snapshot, 20_000), false);
});

test("parseLighterTradeMessage normalizes public WebSocket frames", () => {
  const trades = parseLighterTradeMessage(
    {
      type: "update/trade",
      trades: [
        {
          trade_id_str: "42",
          tx_hash: "0xabc",
          market_id: 1,
          size: "0.5",
          price: "200",
          usd_amount: "100",
          ask_account_id: 10,
          bid_account_id: 20,
          is_maker_ask: true,
          timestamp: 4_000,
        },
      ],
    },
    new Map([[1, "BTC"]]),
    5_000,
  );

  assert.equal(trades.length, 1);
  assert.deepEqual(trades[0], {
    tradeId: "42",
    txHash: "0xabc",
    type: "trade",
    marketId: 1,
    symbol: "BTC",
    size: 0.5,
    price: 200,
    usdAmount: 100,
    askAccountId: 10,
    bidAccountId: 20,
    isMakerAsk: true,
    timestamp: 4_000,
    takerIsAsk: false,
  });
  assert.deepEqual(
    parseLighterTradeMessage({ type: "ping" }, new Map(), 5_000),
    [],
  );
});
