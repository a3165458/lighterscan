"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useI18n } from "@/components/i18n-provider";
import type { MarketChoice } from "@/lib/market-filter";

function MarketFilterInner({
  markets,
  selected,
  param = "market",
}: {
  markets: MarketChoice[];
  selected?: string | null;
  param?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = selected ?? "";
  const chips = [...markets.slice(0, 8)];
  if (current && !chips.some((market) => market.symbol === current)) {
    const extra = markets.find((market) => market.symbol === current);
    if (extra) chips.splice(7, 1, extra);
  }

  function setMarket(symbol: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!symbol) params.delete(param);
    else params.set(param, symbol);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
        {t("filter.market")}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setMarket("")}
          className={`rounded-full px-2.5 py-1.5 text-xs ${
            !current ? "bg-hover text-ink" : "text-muted hover:text-ink"
          }`}
        >
          {t("filter.all")}
        </button>
        {chips.map((market) => (
          <button
            key={market.symbol}
            type="button"
            onClick={() => setMarket(market.symbol)}
            className={`rounded-full px-2.5 py-1.5 text-xs ${
              current === market.symbol
                ? "bg-hover text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {market.symbol}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="market-filter-select">
        {t("filter.more")}
      </label>
      <select
        id="market-filter-select"
        value={current}
        onChange={(event) => setMarket(event.target.value)}
        className="h-8 max-w-[10rem] rounded-full border border-line bg-elev px-2.5 text-xs text-ink"
      >
        <option value="">{t("filter.more")}</option>
        {markets.map((market) => (
          <option key={market.symbol} value={market.symbol}>
            {market.symbol}
          </option>
        ))}
      </select>
    </div>
  );
}

export function MarketFilter(props: {
  markets: MarketChoice[];
  selected?: string | null;
  param?: string;
}) {
  return (
    <Suspense fallback={<div className="h-8" />}>
      <MarketFilterInner {...props} />
    </Suspense>
  );
}
