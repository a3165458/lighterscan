"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, Search as SearchIcon, Star } from "lucide-react";
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

function SortTh({
  label,
  active,
  onSort,
}: {
  label: string;
  active: boolean;
  onSort: () => void;
}) {
  return (
    <th className="num" aria-sort={active ? "descending" : "none"}>
      <button type="button" className="th-sort" data-active={active} onClick={onSort}>
        {label}
        <ArrowDown size={10} className={active ? "" : "opacity-0"} aria-hidden />
      </button>
    </th>
  );
}

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
    <div className="panel flex min-h-0 flex-col overflow-hidden">
      <div className="panel-head">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="panel-title">{t("table.lookup")}</h2>
          <span className="text-[11.5px] tabular text-faint">{rows.length}</span>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="seg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-on={filter === tab.id}
                onClick={() => updateQuery({ class: tab.id })}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <label className="field flex w-full max-w-[15rem] items-center gap-1.5 sm:w-52">
            <SearchIcon size={13} className="shrink-0 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("table.searchMarkets")}
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-faint"
            />
          </label>
        </div>
      </div>
      <div className="scroll-y min-h-0 max-h-[30rem] flex-1 overflow-x-auto sm:max-h-[34rem] xl:max-h-[41rem]">
        <table className="tbl min-w-[700px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-[38px]">
                <span className="sr-only">{t("watch.add")}</span>
              </th>
              <th>{t("table.market")}</th>
              {([
                ["lastPrice", t("table.last")],
                ["change24h", t("table.change")],
                ["volume24h", t("table.volume")],
                ["trades24h", t("table.trades")],
                ["openInterest", t("table.oi")],
              ] as const).map(([id, label]) => (
                <SortTh
                  key={id}
                  label={label}
                  active={sort === id}
                  onSort={() => updateQuery({ sort: id })}
                />
              ))}
              <th className="num w-[104px]">
                <span className="sr-only">{t("table.change")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const on = watched.includes(m.symbol.toUpperCase());
              return (
                <tr key={`${m.marketType}-${m.symbol}`} className="deferred-row">
                  <td>
                    <button
                      type="button"
                      aria-label={on ? t("watch.remove") : t("watch.add")}
                      aria-pressed={on}
                      className={`grid h-6 w-6 place-items-center rounded-md hover:bg-hover ${
                        on ? "text-warn" : "text-faint hover:text-muted"
                      }`}
                      onClick={() => setWatched(toggleWatchlist(m.symbol))}
                    >
                      <Star size={12} fill={on ? "currentColor" : "none"} />
                    </button>
                  </td>
                  <td>
                    <Link
                      href={`/markets/${encodeURIComponent(m.symbol)}`}
                      className="flex items-center gap-2"
                    >
                      <TokenIcon symbol={m.symbol} size={20} />
                      <span className="font-medium">{m.symbol}</span>
                      <span className="tag">{m.marketType}</span>
                    </Link>
                  </td>
                  <td className="num font-medium">{formatPrice(m.lastPrice)}</td>
                  <td className={`num ${pnlClass(m.change24h)}`}>
                    {formatPct(m.change24h)}
                  </td>
                  <td className="num">{compactUsd(m.volume24h)}</td>
                  <td className="num text-muted">{compactNum(m.trades24h, 0)}</td>
                  <td className="num text-muted">
                    {m.marketType === "perp"
                      ? compactUsd(openInterestUsd(m.openInterest, m.markPrice || m.lastPrice))
                      : "—"}
                  </td>
                  <td className="num">
                    <span className="inline-flex justify-end align-middle">
                      <Sparkline values={m.prices} width={88} height={22} />
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
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
