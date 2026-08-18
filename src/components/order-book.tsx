import { PanelHead } from "@/components/ui";
import { formatPrice, formatSize } from "@/lib/format";
import type { OrderBook } from "@/lib/types";

function BookSide({
  label,
  levels,
  max,
  tone,
}: {
  label: string;
  levels: OrderBook["bids"];
  max: number;
  tone: "up" | "down";
}) {
  const up = tone === "up";
  return (
    <div className="min-w-0">
      <div className="px-3 py-1.5">
        <span className={`eyebrow ${up ? "text-up" : "text-down"}`}>{label}</span>
      </div>
      {levels.map((l) => (
        <div key={`${tone}-${l.price}`} className="relative px-3 py-[3px]">
          <div
            className={`absolute inset-y-0 ${up ? "right-0 bg-up/12" : "left-0 bg-down/12"}`}
            style={{ width: `${(l.size / max) * 100}%` }}
          />
          <div className="relative flex justify-between gap-2 text-[12px] tabular">
            <span className={up ? "text-up" : "text-down"}>{formatPrice(l.price)}</span>
            <span className="text-muted">{formatSize(l.size)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

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
      <PanelHead title={title} hint={hint} />
      <div className="grid grid-cols-2 pb-2">
        <div className="border-r border-line">
          <BookSide label={bidsLabel} levels={bids} max={max} tone="up" />
        </div>
        <BookSide label={asksLabel} levels={asks} max={max} tone="down" />
      </div>
    </section>
  );
}
