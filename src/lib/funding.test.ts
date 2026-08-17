import assert from "node:assert/strict";
import test from "node:test";
import { mapFundingRates, pickMarketFunding } from "./funding.ts";

const raw = [
  { market_id: 1, exchange: "lighter", symbol: "BTC", rate: 0.0001 },
  { market_id: 1, exchange: "binance", symbol: "BTC", rate: 0.00002879 },
  { market_id: 1, exchange: "bybit", symbol: "BTC", rate: -0.00002306 },
  { market_id: 2, exchange: "lighter", symbol: "HYPE", rate: 0.000096 },
];

test("mapFundingRates groups venue rates by market", () => {
  const mapped = mapFundingRates(raw);
  assert.equal(mapped.length, 2);
  const btc = mapped.find((row) => row.symbol === "BTC");
  assert.equal(btc?.marketId, 1);
  assert.equal(btc?.lighter, 0.0001);
  assert.equal(btc?.binance, 0.00002879);
  assert.equal(btc?.bybit, -0.00002306);
});

test("pickMarketFunding returns the lighter rate for one market", () => {
  const btc = pickMarketFunding(mapFundingRates(raw), 1);
  assert.equal(btc?.lighter, 0.0001);
  assert.equal(pickMarketFunding(mapFundingRates(raw), 99), null);
});
