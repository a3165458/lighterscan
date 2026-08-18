"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Pager } from "@/components/ui";
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
  anchorId = "funds",
}: {
  account: string;
  selves: Array<string | number>;
  initial: FundPage;
  anchorId?: string;
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
    <section id={anchorId} className="panel overflow-hidden scroll-mt-24">
      <div className="panel-head">
        <div className="min-w-0">
          <h2 className="panel-title">{t("funds.title")}</h2>
          <p className="panel-sub">{t("funds.hint")}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="empty">{t("funds.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl min-w-[720px]">
            <thead>
              <tr>
                <th>{t("account.time")}</th>
                <th>{t("funds.type")}</th>
                <th className="num">{t("funds.amount")}</th>
                <th>{t("log.status")}</th>
                <th>{t("funds.counterparty")}</th>
                <th className="num">{t("log.hash")}</th>
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
            aria: t("funds.title"),
            page: t("funds.page", { page }),
            prev: t("funds.prev"),
            next: t("funds.next"),
          }}
        />
      ) : null}
    </section>
  );
}

function FundRow({ row }: { row: FundMovement }) {
  const { t } = useI18n();
  const inbound = row.direction === "deposit" || row.direction === "transfer_in";
  return (
    <tr>
      <td className="tabular text-muted">
        <Link href={`/logs/${row.hash}`} className="link-accent">
          {formatTime(row.timestamp)}
        </Link>
      </td>
      <td>
        <span className={`font-medium ${inbound ? "text-up" : "text-down"}`}>
          {t(DIRECTION_KEYS[row.direction])}
        </span>
        {row.route ? <span className="text-faint"> · {row.route}</span> : null}
      </td>
      <td className="num font-medium">{formatFundAmount(row.amount, row.asset)}</td>
      <td className="text-muted">{t(fundStatusKey(row.status))}</td>
      <td>
        <FundCounterparty row={row} />
      </td>
      <td className="num">
        <Link
          href={`/logs/${row.hash}`}
          className="font-mono text-[11px] text-faint link-accent"
        >
          {row.hash.slice(0, 10)}
        </Link>
      </td>
    </tr>
  );
}

function FundCounterparty({ row }: { row: FundMovement }) {
  if (row.counterpartyKind === "account" && row.counterparty) {
    return (
      <Link href={`/account/${row.counterparty}`} className="link-accent text-muted">
        {shortAccount(row.counterparty)}
      </Link>
    );
  }
  if (row.counterpartyKind === "address" && canLinkAddress(row.counterparty)) {
    return (
      <Link href={`/address/${row.counterparty}`} className="font-mono text-muted link-accent">
        {shortAddress(row.counterparty, 4)}
      </Link>
    );
  }
  if (row.counterparty) {
    return <span className="font-mono text-faint">{shortAddress(row.counterparty, 4)}</span>;
  }
  return <span className="text-faint">—</span>;
}
