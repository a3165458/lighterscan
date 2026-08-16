import assert from "node:assert/strict";
import test from "node:test";
import type { HistoryFill } from "./history-map.ts";
import { estimateFillPnls, sumRealized } from "./pnl.ts";

function fill(
  partial: Partial<HistoryFill> & Pick<HistoryFill, "hash" | "side" | "price" | "size">,
): HistoryFill {
  return {
    time: "",
    timestamp: 1,
    kind: "Trade",
    marketId: 1,
    usdAmount: partial.price * partial.size,
    role: "taker",
    counterparty: "2",
    selfIndex: "1",
    ...partial,
  };
}

test("opening buys have no realized pnl; closing sell realizes vs average", () => {
  const fills = [
    fill({ hash: "a", timestamp: 1, side: "buy", price: 100, size: 2 }),
    fill({ hash: "b", timestamp: 2, side: "buy", price: 120, size: 2 }),
    fill({ hash: "c", timestamp: 3, side: "sell", price: 130, size: 2 }),
  ];
  const pnls = estimateFillPnls(fills);
  assert.equal(pnls.get("a:1")?.realized, 0);
  assert.equal(pnls.get("b:2")?.realized, 0);
  assert.equal(pnls.get("c:3")?.realized, 40);
  assert.equal(pnls.get("c:3")?.positionAfter, 2);
  assert.equal(pnls.get("c:3")?.avgAfter, 110);
  assert.equal(sumRealized(pnls), 40);
});

test("flipping a long to short realizes the closed size", () => {
  const fills = [
    fill({ hash: "a", timestamp: 1, side: "buy", price: 10, size: 2 }),
    fill({ hash: "b", timestamp: 2, side: "sell", price: 12, size: 3 }),
  ];
  const pnls = estimateFillPnls(fills);
  assert.equal(pnls.get("b:2")?.realized, 4);
  assert.equal(pnls.get("b:2")?.positionAfter, -1);
  assert.equal(pnls.get("b:2")?.avgAfter, 12);
});
