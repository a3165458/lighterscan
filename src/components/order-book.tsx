import { formatPrice, formatSize } from "@/lib/format";
import type { OrderBook } from "@/lib/types";

export function OrderBookView({
  book,
  title,
  hint,
  bidsLabel,
  asksLabel,
}: {
  book: OrderBook;
  title: string;
  hint: string;
  bidsLabel: string;
  asksLabel: string;
}) {
  const asks = [...book.asks].sort((a, b) => a.price - b.price).slice(0, 12);
  const bids = [...book.bids].sort((a, b) => b.price - a.price).slice(0, 12);
  const max = Math.max(
    ...asks.map((l) => l.size),
    ...bids.map((l) => l.size),
    0.0001,
  );

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <div className="grid grid-cols-2 text-xs">
        <div className="border-r border-line">
          <div className="px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-faint">
            {bidsLabel}
          </div>
          {bids.map((l) => (
            <div key={`b-${l.price}`} className="relative px-4 py-1">
              <div
                className="absolute inset-y-0 left-0 bg-up/15"
                style={{ width: `${(l.size / max) * 100}%` }}
              />
              <div className="relative flex justify-between tabular">
                <span className="text-up">{formatPrice(l.price)}</span>
                <span>{formatSize(l.size)}</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-faint">
            {asksLabel}
          </div>
          {asks.map((l) => (
            <div key={`a-${l.price}`} className="relative px-4 py-1">
              <div
                className="absolute inset-y-0 left-0 bg-down/15"
                style={{ width: `${(l.size / max) * 100}%` }}
              />
              <div className="relative flex justify-between tabular">
                <span className="text-down">{formatPrice(l.price)}</span>
                <span>{formatSize(l.size)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
