"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatFundAmount,
  fundStatusKey,
} from "@/components/account-funds";
import { useI18n } from "@/components/i18n-provider";
import { compactNum, compactUsd, formatTime } from "@/lib/format";
import type { FundPage } from "@/lib/funds";
import type { FundDirection, FundMovement } from "@/lib/funds-map";
import type { FrozenTrackerSample } from "@/lib/tracker-metrics";
import type { MsgKey } from "@/lib/i18n";

const DIRECTION_KEYS: Record<FundDirection, MsgKey> = {
  deposit: "funds.deposit",
  withdraw: "funds.withdraw",
  transfer_in: "funds.transferIn",
  transfer_out: "funds.transferOut",
};

export function TrackerBoard({
  sample,
  emptyLabel,
}: {
  sample: FrozenTrackerSample;
  emptyLabel?: string;
}) {
  const { t } = useI18n();
  const rows = sample.whales;
  const [openId, setOpenId] = useState<number | null>(null);

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
            <table className="w-full min-w-[980px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-16" />
                <col className="w-36" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-20" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-16" />
                <col />
                <col className="w-24" />
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
                  <th className="px-3 py-2.5 font-medium">{t("tracker.funds")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <TrackerWhaleRow
                    key={row.accountId}
                    index={index}
                    row={row}
                    open={openId === row.accountId}
                    onToggle={() =>
                      setOpenId((current) =>
                        current === row.accountId ? null : row.accountId,
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function TrackerWhaleRow({
  index,
  row,
  open,
  onToggle,
}: {
  index: number;
  row: FrozenTrackerSample["whales"][number];
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <tr className="border-b border-line last:border-0">
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
        <td className="px-3 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={t("tracker.fundsOpen")}
            className="rounded-full border border-line bg-elev px-2.5 py-1 text-xs hover:bg-hover"
          >
            {open ? t("tracker.fundsClose") : t("tracker.funds")}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-line last:border-0 bg-elev/40">
          <td colSpan={10} className="px-4 py-3">
            <TrackerFundPreview accountId={row.accountId} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function TrackerFundPreview({ accountId }: { accountId: number }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<FundMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(`/api/funds?account=${accountId}&limit=5&selves=${accountId}`)
      .then(async (res) => (await res.json()) as FundPage & { error?: string })
      .then((data) => {
        if (cancelled) return;
        if (data.error && !data.rows?.length) {
          setError(data.error);
          setRows([]);
          return;
        }
        setRows(data.rows || []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("funds.loadFail"));
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, t]); // t is stable per language; no extra explorer traffic on re-render

  if (loading && !rows) {
    return <p className="text-xs text-muted">{t("history.loading")}</p>;
  }
  if (error) {
    return <p className="text-xs text-down">{error}</p>;
  }
  if (!rows?.length) {
    return <p className="text-xs text-muted">{t("tracker.fundsEmpty")}</p>;
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const inbound = row.direction === "deposit" || row.direction === "transfer_in";
          return (
            <li
              key={`${row.hash}-${row.timestamp}-${row.direction}`}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="tabular text-muted">{formatTime(row.timestamp)}</span>
              <span className={inbound ? "text-up" : "text-down"}>
                {t(DIRECTION_KEYS[row.direction])}
              </span>
              <span className="tabular">{formatFundAmount(row.amount, row.asset)}</span>
              <span className="text-muted">{t(fundStatusKey(row.status))}</span>
              <Link href={`/logs/${row.hash}`} className="font-mono text-xs text-muted hover:text-accent">
                {row.hash.slice(0, 10)}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href={`/account/${accountId}#funds`} className="text-xs text-accent hover:underline">
        {t("tracker.fundsMore")}
      </Link>
    </div>
  );
}
