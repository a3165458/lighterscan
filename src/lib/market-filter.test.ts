import assert from "node:assert/strict";
import test from "node:test";
import {
  filterByMarket,
  matchesMarket,
  perpChoices,
  resolveMarketChoice,
} from "./market-filter.ts";

const markets = [
  { marketId: 1, symbol: "BTC", marketType: "perp" },
  { marketId: 2, symbol: "ETH", marketType: "perp" },
  { marketId: 3, symbol: "ETH/USDG", marketType: "spot" },
  { marketId: 4, symbol: "QQQ", marketType: "perp" },
];

test("perpChoices keeps only perps", () => {
  assert.deepEqual(
    perpChoices(markets).map((row) => row.symbol),
    ["BTC", "ETH", "QQQ"],
  );
});

test("resolveMarketChoice accepts symbol, base name, and market id", () => {
  const choices = perpChoices(markets);
  assert.equal(resolveMarketChoice("btc", choices)?.marketId, 1);
  assert.equal(resolveMarketChoice("QQQ", choices)?.symbol, "QQQ");
  assert.equal(resolveMarketChoice("2", choices)?.symbol, "ETH");
  assert.equal(resolveMarketChoice("ETH/USDG", choices), null);
  assert.equal(resolveMarketChoice("", choices), null);
});

test("filterByMarket keeps matching rows and all rows when unselected", () => {
  const rows = [
    { symbol: "BTC", marketId: 1 },
    { symbol: "ETH", marketId: 2 },
    { symbol: "QQQ", marketId: 4 },
  ];
  const btc = resolveMarketChoice("BTC", perpChoices(markets));
  assert.deepEqual(
    filterByMarket(rows, btc, (row) => row).map((row) => row.symbol),
    ["BTC"],
  );
  assert.equal(filterByMarket(rows, null, (row) => row).length, 3);
  assert.equal(matchesMarket(btc, "btc", 99), true);
});
