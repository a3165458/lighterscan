"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatFundAmount,
  fundStatusKey,
} from "@/components/account-funds";
import { useI18n } from "@/components/i18n-provider";
import { Empty, PanelHead } from "@/components/ui";
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
  const windowLabel =
    sample.windowStart && sample.windowEnd
      ? `${formatTime(sample.windowStart)} – ${formatTime(sample.windowEnd)}`
      : t("tracker.collecting");

  return (
    <div className="panel overflow-hidden">
      <PanelHead title={t("tracker.whaleTitle")} hint={t("tracker.equityHint")}>
        <span className="badge">
          <span className="dot-off" />
          {t("tracker.frozen")}
        </span>
      </PanelHead>

      <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5 border-b border-line bg-elev/40 px-3 py-2 text-[11.5px]">
        <Meta label={t("tracker.sample")}>
          {t("tracker.sampleValue", {
            trades: compactNum(sample.sampledTrades, 0),
            markets: sample.markets.length,
          })}
        </Meta>
        <Meta label={t("tracker.window")}>{windowLabel}</Meta>
        <Meta label={t("tracker.markets")} truncate>
          {sample.markets.join(" · ") || "—"}
        </Meta>
      </dl>

      {rows.length === 0 ? (
        <Empty>{emptyLabel || t("tracker.collecting")}</Empty>
      ) : (
        <div className="scroll-y max-h-[42rem] overflow-x-auto">
          <table className="tbl min-w-[940px] table-fixed">
            <colgroup>
              <col className="w-11" />
              <col className="w-24" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-16" />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-16" />
              <col />
              <col className="w-24" />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="num">{t("tracker.rank")}</th>
                <th>{t("tracker.account")}</th>
                <th className="num">{t("tracker.equity")}</th>
                <th className="num">{t("tracker.notional")}</th>
                <th className="num">{t("tracker.trades")}</th>
                <th className="num">{t("tracker.largest")}</th>
                <th className="num">{t("tracker.maker")}</th>
                <th>{t("tracker.side")}</th>
                <th>{t("tracker.focus")}</th>
                <th className="num">{t("tracker.funds")}</th>
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
  );
}

function Meta({
  label,
  children,
  truncate = false,
}: {
  label: string;
  children: React.ReactNode;
  truncate?: boolean;
}) {
  return (
    <div className={`flex items-baseline gap-2 ${truncate ? "min-w-0" : ""}`}>
      <dt className="eyebrow shrink-0">{label}</dt>
      <dd className={`tabular text-muted ${truncate ? "truncate" : ""}`}>{children}</dd>
    </div>
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
  const buy = row.buyShare >= 0.5;
  return (
    <>
      <tr>
        <td className="num text-faint">{index + 1}</td>
        <td>
          <Link
            href={`/account/${row.accountId}`}
            className="font-mono font-medium link-accent"
            translate="no"
          >
            #{row.accountId}
          </Link>
        </td>
        <td className="num font-medium">
          {row.accountValue > 0 ? compactUsd(row.accountValue) : "—"}
        </td>
        <td className="num">{compactUsd(row.observedNotional)}</td>
        <td className="num text-muted">{compactNum(row.tradeCount, 0)}</td>
        <td className="num">{compactUsd(row.largestTrade)}</td>
        <td className="num text-muted">{compactNum(row.makerShare * 100, 1)}%</td>
        <td>
          <span className={buy ? "text-up" : "text-down"}>
            {buy ? t("tape.buy") : t("tape.sell")}
          </span>
        </td>
        <td className="truncate text-muted">
          <span title={row.symbols.join(" · ")}>
            {row.symbols.slice(0, 3).join(" · ")}
          </span>
          {row.marketCount > 3 ? (
            <span className="text-faint">{` +${row.marketCount - 3}`}</span>
          ) : null}
        </td>
        <td className="num">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={t("tracker.fundsOpen")}
            className="btn btn-xs"
          >
            {open ? t("tracker.fundsClose") : t("tracker.funds")}
            <ChevronDown
              size={11}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={10} className="pad-y bg-elev/50">
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
    return <p className="text-[11.5px] text-muted">{t("history.loading")}</p>;
  }
  if (error) {
    return <p className="text-[11.5px] text-down">{error}</p>;
  }
  if (!rows?.length) {
    return <p className="text-[11.5px] text-muted">{t("tracker.fundsEmpty")}</p>;
  }

  return (
    <div className="space-y-1.5">
      <ul className="divide-y divide-line/60 text-[12px]">
        {rows.map((row) => {
          const inbound = row.direction === "deposit" || row.direction === "transfer_in";
          return (
            <li
              key={`${row.hash}-${row.timestamp}-${row.direction}`}
              className="flex items-center gap-3 py-1"
            >
              <span className="w-[104px] shrink-0 tabular text-muted">
                {formatTime(row.timestamp)}
              </span>
              <span
                className={`w-[54px] shrink-0 font-medium ${inbound ? "text-up" : "text-down"}`}
              >
                {t(DIRECTION_KEYS[row.direction])}
              </span>
              <span className="w-[92px] shrink-0 text-right tabular">
                {formatFundAmount(row.amount, row.asset)}
              </span>
              <span className="w-[62px] shrink-0 text-muted">
                {t(fundStatusKey(row.status))}
              </span>
              <Link
                href={`/logs/${row.hash}`}
                className="truncate font-mono text-[11px] text-faint link-accent"
              >
                {row.hash.slice(0, 10)}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href={`/account/${accountId}#funds`}
        className="inline-block text-[11.5px] text-accent hover:underline"
      >
        {t("tracker.fundsMore")}
      </Link>
    </div>
  );
}
