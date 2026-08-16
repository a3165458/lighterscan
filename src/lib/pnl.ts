import type { HistoryFill } from "./history-map.ts";

export type FillPnl = {
  realized: number;
  positionAfter: number;
  avgAfter: number;
};

export function estimateFillPnls(fills: HistoryFill[]): Map<string, FillPnl> {
  const sorted = [...fills].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.hash.localeCompare(b.hash);
  });
  const books = new Map<number, { pos: number; avg: number }>();
  const out = new Map<string, FillPnl>();

  for (const fill of sorted) {
    const book = books.get(fill.marketId) ?? { pos: 0, avg: 0 };
    const signed = fill.side === "buy" ? fill.size : -fill.size;
    let realized = 0;
    const sameWay =
      book.pos === 0 || Math.sign(book.pos) === Math.sign(signed) || signed === 0;

    if (sameWay) {
      const newPos = book.pos + signed;
      const absNew = Math.abs(newPos);
      if (absNew > 1e-12) {
        book.avg =
          (Math.abs(book.pos) * book.avg + fill.size * fill.price) / absNew;
      } else {
        book.avg = 0;
      }
      book.pos = absNew < 1e-12 ? 0 : newPos;
    } else if (Math.abs(signed) <= Math.abs(book.pos) + 1e-12) {
      realized = (fill.price - book.avg) * fill.size * Math.sign(book.pos);
      book.pos += signed;
      if (Math.abs(book.pos) < 1e-12) {
        book.pos = 0;
        book.avg = 0;
      }
    } else {
      const closed = Math.abs(book.pos);
      realized = (fill.price - book.avg) * closed * Math.sign(book.pos);
      book.pos += signed;
      book.avg = fill.price;
    }

    books.set(fill.marketId, book);
    out.set(`${fill.hash}:${fill.timestamp}`, {
      realized,
      positionAfter: book.pos,
      avgAfter: book.avg,
    });
  }
  return out;
}

export function sumRealized(pnls: Map<string, FillPnl>): number {
  let total = 0;
  for (const row of pnls.values()) total += row.realized;
  return total;
}
