"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Pager } from "@/components/ui";
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
  anchorId,
}: {
  account: string;
  selves: Array<string | number>;
  initial: HistoryPage;
  anchorId?: string;
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
    <section id={anchorId} className="panel overflow-hidden scroll-mt-24">
      <div className="panel-head">
        <h2 className="panel-title">{t("history.title")}</h2>
        {fills.length ? (
          <p className={`text-[12.5px] tabular ${pnlClass(realized)}`}>
            {t("history.estRealized", { value: signedUsd(realized) })}
          </p>
        ) : null}
      </div>
      {fills.length === 0 ? (
        <p className="empty">{t("history.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl min-w-[800px]">
            <thead>
              <tr>
                <th>{t("account.time")}</th>
                <th>{t("table.market")}</th>
                <th>{t("account.side")}</th>
                <th className="num">{t("account.size")}</th>
                <th className="num">{t("account.price")}</th>
                <th className="num">{t("account.notional")}</th>
                <th className="num">{t("history.pnl")}</th>
                <th className="num">{t("history.counterparty")}</th>
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
      {error ? <p className="px-3 py-2 text-[11.5px] text-down">{error}</p> : null}
      {pages.length > 1 || hasNext || page > 1 ? (
        <Pager
          page={page}
          pages={pages}
          loading={loading}
          hasNext={hasNext}
          knownEnd={knownEnd}
          onOpen={openPage}
          labels={{
            aria: t("history.title"),
            page: t("history.page", { page }),
            prev: t("history.prev"),
            next: t("history.next"),
          }}
        />
      ) : null}
    </section>
  );
}

function HistoryRow({ fill, pnl }: { fill: HistoryFill; pnl?: FillPnl }) {
  const { t } = useI18n();
  const realized = pnl?.realized ?? 0;
  const sell = fill.side === "sell";
  return (
    <tr>
      <td className="tabular text-muted">
        <Link href={`/logs/${fill.hash}`} className="link-accent">
          {formatTime(fill.timestamp)}
        </Link>
      </td>
      <td className="font-medium">
        <Link
          href={`/markets/${encodeURIComponent(fill.symbol || String(fill.marketId))}`}
          className="link-accent"
        >
          {fill.symbol || fill.marketId}
        </Link>
      </td>
      <td>
        <span className={`font-medium ${sell ? "text-down" : "text-up"}`}>
          {sell ? t("tape.sell") : t("tape.buy")}
        </span>
        <span className="text-faint">
          {" · "}
          {fill.role === "taker" ? t("history.taker") : t("history.maker")}
          {fill.kind.startsWith("Liquidation") ? ` · ${t("history.liq")}` : ""}
        </span>
      </td>
      <td className="num text-muted">{formatSize(fill.size)}</td>
      <td className="num">{formatPrice(fill.price)}</td>
      <td className="num">{compactUsd(fill.usdAmount)}</td>
      <td className={`num ${pnlClass(realized)}`}>
        {realized === 0 ? <span className="text-faint">—</span> : signedUsd(realized)}
      </td>
      <td className="num">
        {fill.counterparty ? (
          <Link href={`/account/${fill.counterparty}`} className="link-accent text-muted">
            {shortAccount(fill.counterparty)}
          </Link>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
    </tr>
  );
}
