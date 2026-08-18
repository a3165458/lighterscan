import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Candle } from "@/lib/types";

type Timeframe = { label: string; href: string; active: boolean };

function TimeframeSeg({ timeframes }: { timeframes: Timeframe[] }) {
  if (!timeframes.length) return null;
  return (
    <div className="seg">
      {timeframes.map((frame) => (
        <Link key={frame.href} href={frame.href} data-on={frame.active} scroll={false}>
          {frame.label}
        </Link>
      ))}
    </div>
  );
}

export function PriceChart({
  candles,
  emptyLabel,
  heading,
  rangeLabel,
  timeframes = [],
}: {
  candles: Candle[];
  emptyLabel: string;
  heading: string;
  rangeLabel: string;
  timeframes?: Timeframe[];
}) {
  if (candles.length < 2) {
    return (
      <div className="panel overflow-hidden">
        <div className="panel-head">
          <h2 className="panel-title">{heading}</h2>
          <TimeframeSeg timeframes={timeframes} />
        </div>
        <p className="empty">{emptyLabel}</p>
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
    <div className="panel overflow-hidden">
      <div className="panel-head">
        <div className="min-w-0">
          <h2 className="panel-title">{heading}</h2>
          {rangeLabel ? <p className="panel-sub tabular">{rangeLabel}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-semibold tabular">{formatPrice(last.c)}</span>
          <TimeframeSeg timeframes={timeframes} />
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-52 w-full sm:h-60">
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#fill)" />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={line}
        />
      </svg>
    </div>
  );
}
