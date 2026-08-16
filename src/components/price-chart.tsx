import { formatPrice } from "@/lib/format";
import type { Candle } from "@/lib/types";

export function PriceChart({
  candles,
  emptyLabel,
  heading,
  rangeLabel,
}: {
  candles: Candle[];
  emptyLabel: string;
  heading: string;
  rangeLabel: string;
}) {
  if (candles.length < 2) {
    return (
      <div className="panel grid h-64 place-items-center text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }
  const w = 760;
  const h = 240;
  const pad = 16;
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = max - min || 1;
  const x = (i: number) =>
    pad + (i / Math.max(candles.length - 1, 1)) * (w - pad * 2);
  const y = (v: number) =>
    pad + (1 - (v - min) / span) * (h - pad * 2);
  const line = candles.map((c, i) => `${x(i).toFixed(1)},${y(c.c).toFixed(1)}`).join(" ");
  const area = `${x(0)},${h - pad} ${line} ${x(candles.length - 1)},${h - pad}`;
  const last = candles[candles.length - 1];
  const first = candles[0];
  const up = last.c >= first.o;
  const color = up ? "var(--up)" : "var(--down)";

  return (
    <div className="panel overflow-hidden p-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-faint">
            {heading}
          </div>
          <div className="text-lg font-semibold tabular">{formatPrice(last.c)}</div>
        </div>
        <div className="text-xs text-muted">{rangeLabel}</div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full">
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#fill)" />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={line}
        />
      </svg>
    </div>
  );
}
