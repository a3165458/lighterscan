import assert from "node:assert/strict";
import test from "node:test";
import {
  annualizedFromRhRate,
  buildFundingBoardRow,
  fundingBoardRows,
  hasLighterFunding,
  hourlyFromRhRate,
  mapFundingRates,
  pickMarketFunding,
  RH_RATE_PERIOD_HOURS,
} from "./funding.ts";

const raw = [
  { market_id: 1, exchange: "lighter", symbol: "BTC", rate: 0.0001 },
  { market_id: 1, exchange: "binance", symbol: "BTC", rate: 0.00002879 },
  { market_id: 1, exchange: "bybit", symbol: "BTC", rate: -0.00002306 },
  { market_id: 1, exchange: "hyperliquid", symbol: "BTC", rate: 0.000008 },
  { market_id: 2, exchange: "lighter", symbol: "HYPE", rate: 0.000096 },
  { market_id: 0, exchange: "lighter", symbol: "ETH", rate: -0.000008 },
  { market_id: 0, exchange: "binance", symbol: "ETH", rate: 0.00001123 },
  { market_id: 9, exchange: "binance", symbol: "ORPHAN", rate: 0.0001 },
];

test("mapFundingRates groups venue rates by market", () => {
  const mapped = mapFundingRates(raw);
  assert.equal(mapped.length, 4);
  const btc = mapped.find((row) => row.symbol === "BTC");
  assert.equal(btc?.marketId, 1);
  assert.equal(btc?.lighter, 0.0001);
  assert.equal(btc?.binance, 0.00002879);
  assert.equal(btc?.bybit, -0.00002306);
  assert.equal(btc?.hyperliquid, 0.000008);
});

test("mapFundingRates skips rows without a market_id", () => {
  assert.equal(
    mapFundingRates([{ exchange: "lighter", symbol: "NOID", rate: 0.0001 }]).length,
    0,
  );
});

test("mapFundingRates keeps ETH market_id 0 and does not invent a Lighter rate", () => {
  const mapped = mapFundingRates(raw);
  const eth = mapped.find((row) => row.symbol === "ETH");
  assert.equal(eth?.marketId, 0);
  assert.equal(eth?.lighter, -0.000008);
  const orphan = mapped.find((row) => row.symbol === "ORPHAN");
  assert.equal(orphan?.lighter, undefined);
  assert.equal(hasLighterFunding(orphan ?? null), false);
});

test("pickMarketFunding returns the lighter rate for one market", () => {
  const btc = pickMarketFunding(mapFundingRates(raw), 1);
  assert.equal(btc?.lighter, 0.0001);
  assert.equal(pickMarketFunding(mapFundingRates(raw), 99), null);
});

test("hourlyFromRhRate divides the 8h-equivalent RH rate by 8", () => {
  assert.equal(RH_RATE_PERIOD_HOURS, 8);
  assert.equal(hourlyFromRhRate(0.00008), 0.00001);
  assert.equal(annualizedFromRhRate(0.00008), 0.00001 * 24 * 365);
});

test("buildFundingBoardRow ranks the largest hourly spread vs Lighter", () => {
  const btc = mapFundingRates(raw).find((row) => row.symbol === "BTC");
  assert.ok(btc && hasLighterFunding(btc));
  const row = buildFundingBoardRow(btc);
  assert.equal(row.vs, "bybit");
  assert.ok(row.spreadHourly != null);
  assert.ok(Math.abs((row.spreadHourly ?? 0) - (0.0001 + 0.00002306) / 8) < 1e-12);
  assert.equal(row.hintSide, "short_lighter");
  assert.ok(row.spreadNative != null);
  assert.ok(Math.abs((row.spreadNative ?? 0) - (0.0001 + 0.00002306)) < 1e-12);
  assert.equal(row.annualizedSpread, null);
});

test("fundingBoardRows drops markets without a Lighter rate and sorts by |spread|", () => {
  const rows = fundingBoardRows(mapFundingRates(raw));
  assert.deepEqual(
    rows.map((row) => row.symbol),
    ["BTC", "ETH", "HYPE"],
  );
  assert.ok(rows[0].spreadAbs >= rows[1].spreadAbs);
});

test("long Lighter when it is cheaper than the comparison venue", () => {
  const row = buildFundingBoardRow({
    marketId: 3,
    symbol: "SOL",
    lighter: -0.0002,
    binance: 0.0001,
  });
  assert.equal(row.vs, "binance");
  assert.equal(row.hintSide, "long_lighter");
  assert.ok(row.annualizedSpread != null);
  assert.ok((row.annualizedSpread ?? 0) < 0);
});
