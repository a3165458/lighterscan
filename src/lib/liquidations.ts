import type { ExplorerTrade } from "./history-map.ts";
import type { Trade } from "./types.ts";

export type LiquidationRow = Trade & {
  accountId: number;
  counterpartyId: number;
  side: "long" | "short";
};

export function isLiquidationTrade(trade: Pick<Trade, "type">): boolean {
  return /liquidat/i.test(trade.type);
}

export function liquidationsFromTrades(trades: Trade[]): LiquidationRow[] {
  const rows: LiquidationRow[] = [];
  for (const trade of trades) {
    if (!isLiquidationTrade(trade)) continue;
    const side = trade.takerIsAsk ? "short" : "long";
    const accountId = trade.takerIsAsk ? trade.askAccountId : trade.bidAccountId;
    const counterpartyId = trade.takerIsAsk
      ? trade.bidAccountId
      : trade.askAccountId;
    rows.push({ ...trade, accountId, counterpartyId, side });
  }
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}

export function liquidationFromExplorerTrade(
  trade: ExplorerTrade,
): LiquidationRow | null {
  if (!/liquidat/i.test(trade.kind)) return null;
  const taker = Number(trade.taker);
  const maker = Number(trade.maker);
  if (!Number.isFinite(taker) || taker <= 0) return null;
  const isTakerAsk = trade.isTakerAsk;
  return {
    tradeId: trade.hash || `${trade.timestamp}:${trade.marketId}:${taker}`,
    txHash: trade.hash,
    type: trade.kind,
    marketId: trade.marketId,
    symbol: trade.symbol,
    size: trade.size,
    price: trade.price,
    usdAmount: trade.usdAmount || trade.price * trade.size,
    askAccountId: isTakerAsk ? taker : maker,
    bidAccountId: isTakerAsk ? maker : taker,
    isMakerAsk: !isTakerAsk,
    timestamp: trade.timestamp,
    takerIsAsk: isTakerAsk,
    accountId: taker,
    counterpartyId: maker,
    side: isTakerAsk ? "short" : "long",
  };
}

export function mergeLiquidationRows(
  ...lists: Array<LiquidationRow[] | undefined>
): LiquidationRow[] {
  const seen = new Set<string>();
  const rows: LiquidationRow[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const row of list) {
      const key = `${row.tradeId}:${row.timestamp}:${row.marketId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}
