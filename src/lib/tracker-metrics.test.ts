import assert from "node:assert/strict";
import test from "node:test";
import type { HistoryFill } from "./history-map.ts";
import {
  accountEquity,
  applyAccountEquities,
  rankTrackedAccounts,
  summarizeTrackedHistory,
} from "./tracker-metrics.ts";
import type { Trade } from "./types.ts";

const trades: Trade[] = [
  {
    tradeId: "btc-1",
    txHash: "hash-1",
    type: "trade",
    marketId: 1,
    symbol: "BTC",
    size: 2,
    price: 100,
    usdAmount: 200,
    askAccountId: 1,
    bidAccountId: 2,
    isMakerAsk: true,
    takerIsAsk: false,
    timestamp: 1_000,
  },
  {
    tradeId: "eth-1",
    txHash: "hash-2",
    type: "trade",
    marketId: 2,
    symbol: "ETH",
    size: 1,
    price: 50,
    usdAmount: 50,
    askAccountId: 1,
    bidAccountId: 3,
    isMakerAsk: false,
    takerIsAsk: true,
    timestamp: 61_000,
  },
];

test("rankTrackedAccounts attributes both sides and keeps observed notional", () => {
  const ranked = rankTrackedAccounts(trades, 3);
  const account = ranked.whales.find((row) => row.accountId === 1);

  assert.equal(account?.tradeCount, 2);
  assert.equal(account?.observedNotional, 250);
  assert.equal(account?.largestTrade, 200);
  assert.equal(account?.makerTrades, 1);
  assert.equal(account?.takerTrades, 1);
  assert.equal(account?.sellTrades, 2);
  assert.deepEqual(account?.symbols, ["BTC", "ETH"]);
});

test("applyAccountEquities ranks whales by official account value", () => {
  const ranked = applyAccountEquities(rankTrackedAccounts(trades, 3), {
    1: { collateral: 80, totalAssetValue: 20 },
    2: { collateral: 400, totalAssetValue: 50 },
    3: { collateral: 10, totalAssetValue: 0 },
  });

  assert.equal(ranked.whales[0].accountId, 2);
  assert.equal(ranked.whales[0].accountValue, 400);
  assert.equal(ranked.whales[1].accountId, 1);
  assert.equal(ranked.whales[1].accountValue, 80);
  assert.equal(ranked.highFrequency.length, 0);
});

test("accountEquity prefers the larger official account value field", () => {
  assert.equal(accountEquity({ collateral: 120, totalAssetValue: 90 }), 120);
  assert.equal(accountEquity({ collateral: 40, totalAssetValue: 75 }), 75);
  assert.equal(accountEquity({ collateral: Number.NaN, totalAssetValue: -8 }), 0);
});

test("rankTrackedAccounts does not count duplicate public trade rows twice", () => {
  const ranked = rankTrackedAccounts([...trades, trades[0]], 3);

  assert.equal(ranked.whales[0].tradeCount, 2);
  assert.equal(ranked.whales[0].observedNotional, 250);
});

test("summarizeTrackedHistory reports an auditable account observation window", () => {
  const fills: HistoryFill[] = [
    {
      hash: "one",
      time: "2026-08-15T00:00:00.000Z",
      timestamp: 0,
      kind: "Trade",
      marketId: 1,
      symbol: "BTC",
      price: 100,
      size: 2,
      usdAmount: 200,
      side: "buy",
      role: "maker",
      counterparty: "2",
      selfIndex: "1",
    },
    {
      hash: "two",
      time: "2026-08-15T00:01:00.000Z",
      timestamp: 60_000,
      kind: "Trade",
      marketId: 2,
      symbol: "ETH",
      price: 50,
      size: 1,
      usdAmount: 50,
      side: "sell",
      role: "taker",
      counterparty: "3",
      selfIndex: "1",
    },
  ];

  const summary = summarizeTrackedHistory(fills);

  assert.equal(summary.tradeCount, 2);
  assert.equal(summary.observedNotional, 250);
  assert.equal(summary.makerShare, 0.5);
  assert.equal(summary.buyShare, 0.5);
  assert.deepEqual(summary.symbols, ["BTC", "ETH"]);
});

test("rankTrackedAccounts ignores invalid accounts and counts self-trades once", () => {
  const selfTrade: Trade = {
    ...trades[0],
    tradeId: "",
    txHash: "",
    symbol: undefined,
    usdAmount: 0,
    price: 10,
    size: 3,
    askAccountId: 2,
    bidAccountId: 2,
  };
  const invalidParticipant: Trade = {
    ...trades[0],
    tradeId: "invalid-account",
    txHash: "",
    askAccountId: 0,
    bidAccountId: 4,
  };

  const ranked = rankTrackedAccounts([selfTrade, invalidParticipant], 200);
  const self = ranked.whales.find((account) => account.accountId === 2);

  assert.equal(self?.tradeCount, 1);
  assert.equal(self?.observedNotional, 30);
  assert.deepEqual(self?.symbols, ["#1"]);
  assert.equal(
    ranked.whales.some((account) => account.accountId === 0),
    false,
  );
});

test("rankTrackedAccounts clamps result limits", () => {
  const ranked = rankTrackedAccounts(trades, 0);

  assert.equal(ranked.whales.length, 1);
  assert.equal(ranked.highFrequency.length, 0);
});

test("summarizeTrackedHistory returns zero metrics for an empty observation", () => {
  const summary = summarizeTrackedHistory([]);

  assert.equal(summary.tradeCount, 0);
  assert.equal(summary.observedNotional, 0);
  assert.equal(summary.firstSeen, 0);
  assert.deepEqual(summary.symbols, []);
});
