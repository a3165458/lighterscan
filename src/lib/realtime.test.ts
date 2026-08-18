import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicRealtimeSnapshot,
  isPublicRealtimeSnapshot,
  isRealtimeSnapshotFresh,
  parseLighterTradeMessage,
  PUBLIC_REALTIME_STALE_MS,
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
  assert.equal(snapshot.liquidations.length, 0);
  assert.deepEqual(snapshot.positions, []);
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
  assert.equal(isRealtimeSnapshotFresh(snapshot, 3_000 + 60_000), true);
  assert.equal(
    isRealtimeSnapshotFresh(snapshot, 3_000 + PUBLIC_REALTIME_STALE_MS),
    true,
  );
  assert.equal(
    isRealtimeSnapshotFresh(snapshot, 3_000 + PUBLIC_REALTIME_STALE_MS + 1),
    false,
  );
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
      liquidation_trades: [
        {
          trade_id_str: "99",
          tx_hash: "0xliq",
          type: "liquidation",
          market_id: 1,
          size: "0.2",
          price: "190",
          usd_amount: "38",
          ask_account_id: 11,
          bid_account_id: 21,
          is_maker_ask: false,
          timestamp: 4_500,
        },
      ],
    },
    new Map([[1, "BTC"]]),
    5_000,
  );

  assert.equal(trades.length, 2);
  assert.equal(trades[0]?.type, "trade");
  assert.equal(trades[1]?.type, "liquidation");
  assert.equal(trades[1]?.tradeId, "99");
  assert.deepEqual(
    parseLighterTradeMessage({ type: "ping" }, new Map(), 5_000),
    [],
  );
});

test("buildPublicRealtimeSnapshot publishes liquidations and ranked positions", () => {
  const snapshot = buildPublicRealtimeSnapshot(
    [
      {
        ...trade,
        tradeId: "liq-1",
        type: "liquidation",
        timestamp: 2_500,
        usdAmount: 80,
        takerIsAsk: true,
      },
    ],
    [{ marketId: 1, symbol: "BTC" }],
    3_000,
    {},
    {
      10: [
        {
          marketId: 1,
          symbol: "BTC",
          sign: 1,
          position: 2,
          avgEntryPrice: 90,
          positionValue: 200,
          unrealizedPnl: 20,
          realizedPnl: 0,
          liquidationPrice: 70,
          allocatedMargin: 40,
          initialMarginFraction: 5000,
          marginMode: 0,
          openOrderCount: 0,
        },
      ],
    },
  );

  assert.equal(snapshot.liquidations[0]?.tradeId, "liq-1");
  assert.equal(snapshot.liquidations[0]?.accountId, 10);
  assert.equal(snapshot.positions[0]?.accountId, 10);
  assert.equal(snapshot.positions[0]?.symbol, "BTC");
  assert.equal(snapshot.positions[0]?.side, "long");
});
