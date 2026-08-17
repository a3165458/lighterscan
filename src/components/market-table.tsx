"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Sparkline } from "@/components/sparkline";
import { TokenIcon } from "@/components/token-icon";
import { useI18n } from "@/components/i18n-provider";
import {
  compactNum,
  compactUsd,
  formatPct,
  formatPrice,
  openInterestUsd,
  pnlClass,
} from "@/lib/format";
import { readWatchlist, toggleWatchlist } from "@/lib/watchlist";
import type { AssetClass, Market } from "@/lib/types";

type Filter = "all" | AssetClass;
type SortKey = "volume24h" | "trades24h" | "change24h" | "openInterest" | "lastPrice";

const SORTS = new Set<SortKey>([
  "volume24h",
  "trades24h",
  "change24h",
  "openInterest",
  "lastPrice",
]);

export function MarketTable({ markets }: { markets: Market[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("class");
  const sortParam = searchParams.get("sort");
  const filter: Filter =
    filterParam === "crypto" || filterParam === "rwa" || filterParam === "spot"
      ? filterParam
      : "all";
  const sort: SortKey = SORTS.has(sortParam as SortKey)
    ? (sortParam as SortKey)
    : "volume24h";
  const [q, setQ] = useState("");
  const [watched, setWatched] = useState<string[]>(() => readWatchlist());

  function updateQuery(next: { class?: Filter; sort?: SortKey }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextFilter = next.class ?? filter;
    const nextSort = next.sort ?? sort;
    if (nextFilter === "all") params.delete("class");
    else params.set("class", nextFilter);
    if (nextSort === "volume24h") params.delete("sort");
    else params.set("sort", nextSort);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const query = q.trim().toUpperCase();
  const rows = markets
    .filter((m) => (filter === "all" ? true : m.assetClass === filter))
    .filter((m) => !query || m.symbol.toUpperCase().includes(query))
    .sort((a, b) => {
      if (sort === "change24h") return Math.abs(b.change24h) - Math.abs(a.change24h);
      return (b[sort] as number) - (a[sort] as number);
    });

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: t("table.all") },
    { id: "crypto", label: t("table.crypto") },
    { id: "rwa", label: t("table.rwa") },
    { id: "spot", label: t("table.spot") },
  ];

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="text-sm font-semibold">{t("table.lookup")}</div>
        <div className="flex rounded-full bg-elev p-0.5 text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => updateQuery({ class: tab.id })}
              className={`rounded-full px-3 py-1 ${
                filter === tab.id ? "bg-card text-ink shadow-sm" : "text-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("table.searchMarkets")}
          className="ml-auto h-8 w-full max-w-xs rounded-full border border-line bg-elev px-3 text-sm outline-none placeholder:text-faint"
        />
      </div>
      <div className="overflow-x-auto lg:max-h-[520px] lg:overflow-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-card text-[11px] uppercase tracking-[0.12em] text-faint">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-medium">{t("table.market")}</th>
              <th className="px-3 py-2.5 font-medium">{t("table.last")}</th>
              <th className="px-3 py-2.5 font-medium">{t("table.change")}</th>
              <th className="px-3 py-2.5 font-medium">
                <button type="button" onClick={() => updateQuery({ sort: "volume24h" })}>
                  {t("table.volume")}
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium">
                <button type="button" onClick={() => updateQuery({ sort: "trades24h" })}>
                  {t("table.trades")}
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium">
                <button type="button" onClick={() => updateQuery({ sort: "openInterest" })}>
                  {t("table.oi")}
                </button>
              </th>
              <th className="px-4 py-2.5 font-medium">{t("table.change")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={`${m.marketType}-${m.symbol}`} className="deferred-row border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <Link href={`/markets/${encodeURIComponent(m.symbol)}`} className="flex items-center gap-2.5">
                    <TokenIcon symbol={m.symbol} size={24} />
                    <span>
                      <span className="font-medium">{m.symbol}</span>
                      <span className="ml-2 text-[11px] uppercase text-faint">
                        {m.marketType}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="ml-1 text-[11px] text-muted hover:text-ink"
                      onClick={(event) => {
                        event.preventDefault();
                        setWatched(toggleWatchlist(m.symbol));
                      }}
                    >
                      {watched.includes(m.symbol.toUpperCase())
                        ? t("watch.remove")
                        : t("watch.add")}
                    </button>
                  </Link>
                </td>
                <td className="px-3 py-2.5 tabular">{formatPrice(m.lastPrice)}</td>
                <td className={`px-3 py-2.5 tabular ${pnlClass(m.change24h)}`}>
                  {formatPct(m.change24h)}
                </td>
                <td className="px-3 py-2.5 tabular">{compactUsd(m.volume24h)}</td>
                <td className="px-3 py-2.5 tabular text-muted">{compactNum(m.trades24h, 0)}</td>
                <td className="px-3 py-2.5 tabular text-muted">
                  {m.marketType === "perp"
                    ? compactUsd(openInterestUsd(m.openInterest, m.markPrice || m.lastPrice))
                    : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <Sparkline values={m.prices} />
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  {t("table.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
