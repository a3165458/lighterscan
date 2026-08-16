"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  compactUsd,
  formatPrice,
  formatSize,
  formatTime,
  pnlClass,
  shortAccount,
  signedUsd,
} from "@/lib/format";
import type { HistoryPage } from "@/lib/history";
import {
  HISTORY_PAGE_SIZE,
  historyPageOffset,
  visibleHistoryPages,
} from "@/lib/history-pages";
import type { HistoryFill } from "@/lib/history-map";
import { estimateFillPnls, sumRealized, type FillPnl } from "@/lib/pnl";

export function AccountHistory({
  account,
  selves,
  initial,
}: {
  account: string;
  selves: Array<string | number>;
  initial: HistoryPage;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [fills, setFills] = useState(initial.fills);
  const [hasNext, setHasNext] = useState(initial.hasMore);
  const [knownEnd, setKnownEnd] = useState(initial.hasMore ? 3 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pnls = useMemo(() => estimateFillPnls(fills), [fills]);
  const realized = useMemo(() => sumRealized(pnls), [pnls]);
  const pages = visibleHistoryPages(page, hasNext || knownEnd > page);

  async function openPage(nextPage: number) {
    if (loading || nextPage < 1 || nextPage === page) return;
    if (nextPage > page && !hasNext && nextPage > knownEnd) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/history?account=${encodeURIComponent(account)}&offset=${historyPageOffset(nextPage)}&limit=${HISTORY_PAGE_SIZE}&selves=${encodeURIComponent(selves.join(","))}`,
      );
      const data = (await res.json()) as HistoryPage & { error?: string };
      if (data.error && !data.fills?.length) {
        setError(data.error);
        return;
      }
      setPage(nextPage);
      setFills(data.fills || []);
      setHasNext(Boolean(data.hasMore));
      setKnownEnd((current) => Math.max(current, nextPage, data.hasMore ? nextPage + 1 : nextPage));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("history.loadFail"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("history.title")}</h2>
          {fills.length ? (
            <p className={`text-sm tabular ${pnlClass(realized)}`}>
              {t("history.estRealized", { value: signedUsd(realized) })}
            </p>
          ) : null}
        </div>
      </div>
      {fills.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">{t("history.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-faint">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">{t("account.time")}</th>
                <th className="px-3 py-2 font-medium">{t("table.market")}</th>
                <th className="px-3 py-2 font-medium">{t("account.side")}</th>
                <th className="px-3 py-2 font-medium">{t("account.size")}</th>
                <th className="px-3 py-2 font-medium">{t("account.price")}</th>
                <th className="px-3 py-2 font-medium">{t("account.notional")}</th>
                <th className="px-3 py-2 font-medium">{t("history.pnl")}</th>
                <th className="px-4 py-2 font-medium">{t("history.counterparty")}</th>
              </tr>
            </thead>
            <tbody>
              {fills.map((fill) => (
                <HistoryRow
                  key={`${fill.hash}-${fill.timestamp}`}
                  fill={fill}
                  pnl={pnls.get(`${fill.hash}:${fill.timestamp}`)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error ? <p className="px-4 py-2 text-xs text-down">{error}</p> : null}
      {pages.length > 1 || hasNext || page > 1 ? (
        <nav
          className="flex items-center justify-between gap-3 border-t border-line px-4 py-3"
          aria-label={t("history.title")}
        >
          <p className="w-20 shrink-0 text-xs tabular text-muted">
            {t("history.page", { page })}
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => void openPage(page - 1)}
              disabled={loading || page <= 1}
              className="h-8 w-16 shrink-0 rounded-full border border-line bg-elev text-sm leading-none hover:bg-hover disabled:opacity-60"
            >
              {t("history.prev")}
            </button>
            {pages.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => void openPage(value)}
                disabled={loading}
                aria-current={value === page ? "page" : undefined}
                className={`h-8 w-8 shrink-0 rounded-full border text-sm leading-none tabular ${
                  value === page
                    ? "border-line bg-card font-medium"
                    : "border-line bg-elev hover:bg-hover"
                } disabled:opacity-60`}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void openPage(page + 1)}
              disabled={loading || (!hasNext && page >= knownEnd)}
              className="h-8 w-16 shrink-0 rounded-full border border-line bg-elev text-sm leading-none hover:bg-hover disabled:opacity-60"
            >
              {t("history.next")}
            </button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}

function HistoryRow({ fill, pnl }: { fill: HistoryFill; pnl?: FillPnl }) {
  const { t } = useI18n();
  const realized = pnl?.realized ?? 0;
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2 tabular text-muted">
        <Link href={`/logs/${fill.hash}`} className="hover:text-accent">
          {formatTime(fill.timestamp)}
        </Link>
      </td>
      <td className="px-3 py-2">
        <Link href={`/markets/${encodeURIComponent(fill.symbol || String(fill.marketId))}`}>
          {fill.symbol || fill.marketId}
        </Link>
      </td>
      <td className={`px-3 py-2 ${fill.side === "sell" ? "text-down" : "text-up"}`}>
        {fill.side === "sell" ? t("tape.sell") : t("tape.buy")} ·{" "}
        {fill.role === "taker" ? t("history.taker") : t("history.maker")}
        {fill.kind.startsWith("Liquidation") ? ` · ${t("history.liq")}` : ""}
      </td>
      <td className="px-3 py-2 tabular">{formatSize(fill.size)}</td>
      <td className="px-3 py-2 tabular">{formatPrice(fill.price)}</td>
      <td className="px-3 py-2 tabular">{compactUsd(fill.usdAmount)}</td>
      <td className={`px-3 py-2 tabular ${pnlClass(realized)}`}>
        {realized === 0 ? "—" : signedUsd(realized)}
      </td>
      <td className="px-4 py-2">
        {fill.counterparty ? (
          <Link href={`/account/${fill.counterparty}`} className="hover:text-accent">
            {shortAccount(fill.counterparty)}
          </Link>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
