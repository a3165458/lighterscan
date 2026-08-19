"use client";

import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { useMemo, useState } from "react";
import { TokenIcon } from "@/components/token-icon";
import { useI18n } from "@/components/i18n-provider";
import { formatFundingPct, pnlClass } from "@/lib/format";
import type { CompareVenue, FundingBoardRow } from "@/lib/funding";

type SortKey =
  | "spread"
  | "symbol"
  | "lighter"
  | "hyperliquid"
  | "binance"
  | "bybit"
  | "annualized";

const VENUE_KEY: Record<CompareVenue, "funding.hyperliquid" | "funding.binance" | "funding.bybit"> =
  {
    hyperliquid: "funding.hyperliquid",
    binance: "funding.binance",
    bybit: "funding.bybit",
  };

function SortTh({
  label,
  active,
  onSort,
  align = "num",
}: {
  label: string;
  active: boolean;
  onSort: () => void;
  align?: "num" | "start";
}) {
  return (
    <th className={align === "num" ? "num" : undefined} aria-sort={active ? "descending" : "none"}>
      <button type="button" className="th-sort" data-active={active} onClick={onSort}>
        {label}
        <ArrowDown size={10} className={active ? "" : "opacity-0"} aria-hidden />
      </button>
    </th>
  );
}

function RateCell({ rate }: { rate?: number }) {
  if (rate == null) return <td className="num text-faint">—</td>;
  return <td className={`num ${pnlClass(rate)}`}>{formatFundingPct(rate)}</td>;
}

export function FundingBoard({
  rows,
  emptyLabel,
}: {
  rows: FundingBoardRow[];
  emptyLabel: string;
}) {
  const { t } = useI18n();
  const [sort, setSort] = useState<SortKey>("spread");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sort === "symbol") return a.symbol.localeCompare(b.symbol);
      if (sort === "lighter") return b.lighter - a.lighter;
      if (sort === "hyperliquid" || sort === "binance" || sort === "bybit") {
        return (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity);
      }
      if (sort === "annualized") {
        return (b.annualizedSpread ?? -Infinity) - (a.annualizedSpread ?? -Infinity);
      }
      return b.spreadAbs - a.spreadAbs || a.symbol.localeCompare(b.symbol);
    });
    return copy;
  }, [rows, sort]);

  if (rows.length === 0) {
    return <p className="empty">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="tbl min-w-[860px]">
        <thead>
          <tr>
            <SortTh
              label={t("funding.symbol")}
              active={sort === "symbol"}
              onSort={() => setSort("symbol")}
              align="start"
            />
            <SortTh
              label={t("funding.lighter")}
              active={sort === "lighter"}
              onSort={() => setSort("lighter")}
            />
            <SortTh
              label={t("funding.hyperliquid")}
              active={sort === "hyperliquid"}
              onSort={() => setSort("hyperliquid")}
            />
            <SortTh
              label={t("funding.binance")}
              active={sort === "binance"}
              onSort={() => setSort("binance")}
            />
            <SortTh
              label={t("funding.bybit")}
              active={sort === "bybit"}
              onSort={() => setSort("bybit")}
            />
            <SortTh
              label={t("funding.spread")}
              active={sort === "spread"}
              onSort={() => setSort("spread")}
            />
            <th>{t("funding.side")}</th>
            <SortTh
              label={t("funding.annualized")}
              active={sort === "annualized"}
              onSort={() => setSort("annualized")}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const venueLabel = row.vs ? t(VENUE_KEY[row.vs]) : "";
            const hint =
              row.hintSide === "short_lighter"
                ? t("funding.shortLighter", { venue: venueLabel })
                : row.hintSide === "long_lighter"
                  ? t("funding.longLighter", { venue: venueLabel })
                  : t("funding.none");
            return (
              <tr key={row.marketId} className="deferred-row">
                <td>
                  <Link
                    href={`/markets/${encodeURIComponent(row.symbol)}`}
                    className="flex items-center gap-2"
                  >
                    <TokenIcon symbol={row.symbol} size={18} />
                    <span className="font-medium">{row.symbol}</span>
                  </Link>
                </td>
                <RateCell rate={row.lighter} />
                <RateCell rate={row.hyperliquid} />
                <RateCell rate={row.binance} />
                <RateCell rate={row.bybit} />
                <td className={`num ${row.spreadNative != null ? pnlClass(row.spreadNative) : "text-faint"}`}>
                  {row.spreadNative != null ? (
                    <span>
                      {formatFundingPct(row.spreadNative)}
                      {row.vs ? (
                        <span className="ml-1 tag">{t("funding.vs", { venue: t(VENUE_KEY[row.vs]) })}</span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {row.hintSide ? (
                    <span className={`badge ${row.hintSide === "short_lighter" ? "badge-down" : "badge-up"}`}>
                      {hint}
                    </span>
                  ) : (
                    <span className="text-faint">{hint}</span>
                  )}
                </td>
                <td
                  className={`num ${
                    row.annualizedSpread != null ? pnlClass(row.annualizedSpread) : "text-faint"
                  }`}
                >
                  {row.annualizedSpread != null ? formatFundingPct(row.annualizedSpread, 2) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
