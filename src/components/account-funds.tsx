"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  canLinkAddress,
  compactUsd,
  formatSize,
  formatTime,
  shortAccount,
  shortAddress,
} from "@/lib/format";
import type { FundPage } from "@/lib/funds";
import type { FundDirection, FundMovement } from "@/lib/funds-map";
import { isStableFundAsset } from "@/lib/funds-map";
import {
  HISTORY_PAGE_SIZE,
  historyPageOffset,
  visibleHistoryPages,
} from "@/lib/history-pages";
import type { MsgKey } from "@/lib/i18n";

const DIRECTION_KEYS: Record<FundDirection, MsgKey> = {
  deposit: "funds.deposit",
  withdraw: "funds.withdraw",
  transfer_in: "funds.transferIn",
  transfer_out: "funds.transferOut",
};

const STATUS_KEYS: Record<string, MsgKey> = {
  executed: "funds.status.executed",
  nothing_to_execute: "funds.status.pending",
  committed: "funds.status.committed",
  verified: "funds.status.verified",
};

export function formatFundAmount(amount: number, asset: string): string {
  if (isStableFundAsset(asset)) return compactUsd(amount);
  return `${formatSize(amount)} ${asset}`.trim();
}

export function fundStatusKey(status: string): MsgKey {
  return STATUS_KEYS[status] ?? "funds.status.unknown";
}

export function AccountFunds({
  account,
  selves,
  initial,
}: {
  account: string;
  selves: Array<string | number>;
  initial: FundPage;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(initial.rows);
  const [hasNext, setHasNext] = useState(initial.hasMore);
  const [knownEnd, setKnownEnd] = useState(initial.hasMore ? 3 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pages = visibleHistoryPages(page, hasNext || knownEnd > page);

  async function openPage(nextPage: number) {
    if (loading || nextPage < 1 || nextPage === page) return;
    if (nextPage > page && !hasNext && nextPage > knownEnd) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/funds?account=${encodeURIComponent(account)}&offset=${historyPageOffset(nextPage)}&limit=${HISTORY_PAGE_SIZE}&selves=${encodeURIComponent(selves.join(","))}`,
      );
      const data = (await res.json()) as FundPage & { error?: string };
      if (data.error && !data.rows?.length) {
        setError(data.error);
        return;
      }
      setPage(nextPage);
      setRows(data.rows || []);
      setHasNext(Boolean(data.hasMore));
      setKnownEnd((current) =>
        Math.max(current, nextPage, data.hasMore ? nextPage + 1 : nextPage),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("funds.loadFail"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="funds" className="panel overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{t("funds.title")}</h2>
        <p className="mt-0.5 text-xs text-muted">{t("funds.hint")}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">{t("funds.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-faint">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">{t("account.time")}</th>
                <th className="px-3 py-2 font-medium">{t("funds.type")}</th>
                <th className="px-3 py-2 font-medium">{t("funds.amount")}</th>
                <th className="px-3 py-2 font-medium">{t("log.status")}</th>
                <th className="px-3 py-2 font-medium">{t("funds.counterparty")}</th>
                <th className="px-4 py-2 font-medium">{t("log.hash")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <FundRow key={`${row.hash}-${row.timestamp}-${row.direction}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error ? <p className="px-4 py-2 text-xs text-down">{error}</p> : null}
      {pages.length > 1 || hasNext || page > 1 ? (
        <nav
          className="flex items-center justify-between gap-3 border-t border-line px-4 py-3"
          aria-label={t("funds.title")}
        >
          <p className="w-20 shrink-0 text-xs tabular text-muted">
            {t("funds.page", { page })}
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => void openPage(page - 1)}
              disabled={loading || page <= 1}
              className="h-8 w-16 shrink-0 rounded-full border border-line bg-elev text-sm leading-none hover:bg-hover disabled:opacity-60"
            >
              {t("funds.prev")}
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
              {t("funds.next")}
            </button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}

function FundRow({ row }: { row: FundMovement }) {
  const { t } = useI18n();
  const inbound = row.direction === "deposit" || row.direction === "transfer_in";
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2 tabular text-muted">
        <Link href={`/logs/${row.hash}`} className="hover:text-accent">
          {formatTime(row.timestamp)}
        </Link>
      </td>
      <td className={`px-3 py-2 ${inbound ? "text-up" : "text-down"}`}>
        {t(DIRECTION_KEYS[row.direction])}
        {row.route ? <span className="text-muted"> · {row.route}</span> : null}
      </td>
      <td className="px-3 py-2 tabular">{formatFundAmount(row.amount, row.asset)}</td>
      <td className="px-3 py-2 text-muted">{t(fundStatusKey(row.status))}</td>
      <td className="px-3 py-2">
        <FundCounterparty row={row} />
      </td>
      <td className="px-4 py-2">
        <Link href={`/logs/${row.hash}`} className="font-mono text-xs text-muted hover:text-accent">
          {row.hash.slice(0, 10)}
        </Link>
      </td>
    </tr>
  );
}

function FundCounterparty({ row }: { row: FundMovement }) {
  if (row.counterpartyKind === "account" && row.counterparty) {
    return (
      <Link href={`/account/${row.counterparty}`} className="hover:text-accent">
        {shortAccount(row.counterparty)}
      </Link>
    );
  }
  if (row.counterpartyKind === "address" && canLinkAddress(row.counterparty)) {
    return (
      <Link href={`/address/${row.counterparty}`} className="font-mono hover:text-accent">
        {shortAddress(row.counterparty, 4)}
      </Link>
    );
  }
  if (row.counterparty) {
    return <span className="font-mono text-muted">{shortAddress(row.counterparty, 4)}</span>;
  }
  return "—";
}
