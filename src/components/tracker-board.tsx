"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { compactNum, compactUsd, formatTime } from "@/lib/format";
import type { FrozenTrackerSample } from "@/lib/tracker-metrics";

export function TrackerBoard({
  sample,
  emptyLabel,
}: {
  sample: FrozenTrackerSample;
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  const rows = sample.whales;

  return (
    <>
      <section className="panel grid gap-3 px-4 py-3 text-xs text-muted sm:grid-cols-3">
        <div>
          <div className="text-faint">{t("tracker.sample")}</div>
          <div className="mt-1 text-sm text-ink">
            {t("tracker.sampleValue", {
              trades: compactNum(sample.sampledTrades, 0),
              markets: sample.markets.length,
            })}
          </div>
        </div>
        <div>
          <div className="text-faint">{t("tracker.window")}</div>
          <div className="mt-1 text-sm text-ink">
            {sample.windowStart && sample.windowEnd
              ? `${formatTime(sample.windowStart)} – ${formatTime(sample.windowEnd)}`
              : t("tracker.collecting")}
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-faint">{t("tracker.markets")}</div>
            <div
              className="mt-1 truncate text-sm text-ink"
              title={sample.markets.join(" · ")}
            >
              {sample.markets.join(" · ") || "—"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-faint" />
            {t("tracker.frozen")}
          </div>
        </div>
      </section>

      <div className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{t("tracker.whaleTitle")}</h2>
          <p className="mt-0.5 text-xs text-muted">{t("tracker.equityHint")}</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {emptyLabel || t("tracker.collecting")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-16" />
                <col className="w-36" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-20" />
                <col className="w-24" />
                <col className="w-24" />
                <col />
              </colgroup>
              <thead className="text-[11px] uppercase tracking-[0.12em] text-faint">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-medium">{t("tracker.rank")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("tracker.account")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("tracker.equity")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("tracker.notional")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("tracker.trades")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("tracker.largest")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("tracker.maker")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("tracker.side")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("tracker.focus")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.accountId}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-4 py-2.5 tabular text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      <Link
                        href={`/account/${row.accountId}`}
                        className="font-medium hover:text-accent"
                        translate="no"
                      >
                        #{row.accountId}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 tabular font-medium">
                      {row.accountValue > 0 ? compactUsd(row.accountValue) : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular">
                      {compactUsd(row.observedNotional)}
                    </td>
                    <td className="px-3 py-2.5 tabular">
                      {compactNum(row.tradeCount, 0)}
                    </td>
                    <td className="px-3 py-2.5 tabular">
                      {compactUsd(row.largestTrade)}
                    </td>
                    <td className="px-3 py-2.5 tabular">
                      {compactNum(row.makerShare * 100, 1)}%
                    </td>
                    <td className="px-3 py-2.5 tabular text-muted">
                      {row.buyShare >= 0.5 ? t("tape.buy") : t("tape.sell")}
                    </td>
                    <td className="truncate px-4 py-2.5 text-muted">
                      <span title={row.symbols.join(" · ")}>
                        {row.symbols.slice(0, 3).join(" · ")}
                      </span>
                      {row.marketCount > 3 ? ` +${row.marketCount - 3}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
