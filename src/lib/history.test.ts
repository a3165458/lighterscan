import assert from "node:assert/strict";
import test from "node:test";
import { describeExplorerLog, explorerLookupId, mapExplorerLog } from "./history-map.ts";
import { historyPageOffset, visibleHistoryPages } from "./history-pages.ts";

const sample = {
  hash: "abc",
  time: "2026-08-15T15:12:38.265Z",
  pubdata_type: "Trade",
  pubdata: {
    trade_pubdata: {
      trade_type: 0,
      market_index: 1,
      is_taker_ask: 0,
      taker_account_index: "1913",
      maker_account_index: "4790",
      price: "63006.3",
      size: "0.00101",
    },
  },
};

test("explorer lookup prefers account index over lowercase address", () => {
  assert.equal(
    explorerLookupId("0x5179ea50e68af4321dac3a62df941d0abe0b6b85", [4601]),
    "4601",
  );
  assert.equal(
    explorerLookupId(
      "0x5179ea50e68af4321dac3a62df941d0abe0b6b85",
      [],
      "0x5179Ea50E68af4321dac3a62df941d0ABe0b6b85",
    ),
    "0x5179Ea50E68af4321dac3a62df941d0ABe0b6b85",
  );
});

test("taker bid is a buy for the queried account", () => {
  const fill = mapExplorerLog(sample, [1913], { 1: "BTC" });
  assert.ok(fill);
  assert.equal(fill.side, "buy");
  assert.equal(fill.role, "taker");
  assert.equal(fill.symbol, "BTC");
  assert.equal(fill.counterparty, "4790");
  assert.ok(fill.usdAmount > 60);
});

test("maker against a bid is a sell", () => {
  const fill = mapExplorerLog(sample, ["4790"]);
  assert.ok(fill);
  assert.equal(fill.side, "sell");
  assert.equal(fill.role, "maker");
  assert.equal(fill.counterparty, "1913");
});

test("unrelated account is skipped", () => {
  assert.equal(mapExplorerLog(sample, [7]), null);
});

test("describeExplorerLog exposes price and market without a self account", () => {
  const trade = describeExplorerLog(sample, { 1: "BTC" });
  assert.ok(trade);
  assert.equal(trade.symbol, "BTC");
  assert.equal(trade.price, 63006.3);
  assert.equal(trade.size, 0.00101);
  assert.equal(trade.taker, "1913");
  assert.equal(trade.maker, "4790");
});

test("taker ask is a sell", () => {
  const ask = structuredClone(sample);
  (ask.pubdata.trade_pubdata as { is_taker_ask: number }).is_taker_ask = 1;
  const fill = mapExplorerLog(ask, [1913]);
  assert.ok(fill);
  assert.equal(fill.side, "sell");
});

test("historyPageOffset maps 1-based pages onto explorer offsets", () => {
  assert.equal(historyPageOffset(1, 40), 0);
  assert.equal(historyPageOffset(3, 40), 80);
  assert.equal(historyPageOffset(0, 40), 0);
});

test("visibleHistoryPages keeps a compact 1 2 3 window around the current page", () => {
  assert.deepEqual(visibleHistoryPages(1, true), [1, 2, 3]);
  assert.deepEqual(visibleHistoryPages(4, true), [3, 4, 5]);
  assert.deepEqual(visibleHistoryPages(2, false), [1, 2]);
});
