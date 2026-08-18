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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="eyebrow">{t("filter.market")}</span>
      <div className="flex flex-wrap items-center gap-0.5">
        <button
          type="button"
          className="chip"
          data-on={!current}
          onClick={() => setMarket("")}
        >
          {t("filter.all")}
        </button>
        {chips.map((market) => (
          <button
            key={market.symbol}
            type="button"
            className="chip"
            data-on={current === market.symbol}
            onClick={() => setMarket(market.symbol)}
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
        className="field h-[26px] max-w-[9rem] text-[11.5px]"
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
    <Suspense fallback={<div className="h-[26px]" />}>
      <MarketFilterInner {...props} />
    </Suspense>
  );
}
