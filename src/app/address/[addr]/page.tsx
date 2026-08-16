import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountHistory } from "@/components/account-history";
import { PositionsTable } from "@/components/positions-table";
import { StatCard } from "@/components/stat-card";
import {
  canLinkAddress,
  compactUsd,
  isRedactedAddress,
  pnlClass,
  shortAddress,
  signedUsd,
} from "@/lib/format";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { estimateFillPnls, sumRealized } from "@/lib/pnl";
import { positionLabels } from "@/lib/position-labels";
import { explorerLookupId, getAccountTradeHistory } from "@/lib/history";
import { getAccountsByAddress, getMarkets, RhError } from "@/lib/rh";

export const revalidate = 8;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ addr: string }>;
}) {
  const { addr } = await params;
  return { title: shortAddress(addr, 4) };
}

export default async function AddressPage({
  params,
}: {
  params: Promise<{ addr: string }>;
}) {
  const { addr } = await params;
  const lang = await getRequestLang();
  if (!canLinkAddress(addr) || isRedactedAddress(addr)) notFound();
  let bundle;
  try {
    bundle = await getAccountsByAddress(addr);
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
    if (status === 404 || (err instanceof RhError && err.status === 404)) notFound();
    throw err;
  }

  const markets = await getMarkets().catch(() => []);
  const marketNames = Object.fromEntries(markets.map((m) => [m.marketId, m.symbol]));
  const selves = bundle.accounts.map((a) => a.index);
  const checksum = bundle.primary.l1Address || bundle.accounts[0]?.l1Address;
  const lookupIds = selves.length
    ? selves
    : [explorerLookupId(addr, [], checksum)];
  const historyPages = await Promise.all(
    lookupIds.map((id) =>
      getAccountTradeHistory(String(id), 0, 40, [id], marketNames).catch(() => ({
        fills: [],
        nextOffset: 0,
        hasMore: false,
      })),
    ),
  );
  const allPositions = bundle.accounts.flatMap((a) =>
    a.positions
      .filter((p) => p.position !== 0)
      .map((p) => ({ ...p, symbol: `${p.symbol}` })),
  );
  const collateral = bundle.accounts.reduce((s, a) => s + a.collateral, 0);
  const uPnl = allPositions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const rPnl = allPositions.reduce((s, p) => s + p.realizedPnl, 0);
  const exposure = allPositions.reduce((s, p) => s + Math.abs(p.positionValue), 0);
  const estRealized = historyPages.reduce(
    (sum, page) => sum + sumRealized(estimateFillPnls(page.fills)),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted">
        {t(lang, "address.crumb")}
        <span className="mx-1.5 text-faint">/</span>
        {shortAddress(addr, 6)}
      </div>
      <div>
        <h1 className="break-all font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
          {addr}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t(
            lang,
            bundle.accounts.length === 1 ? "address.linkedOne" : "address.linkedMany",
            { count: bundle.accounts.length },
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={t(lang, "address.accounts")}
          value={String(bundle.accounts.length)}
          hint={t(lang, "address.accountsHint")}
        />
        <StatCard label={t(lang, "account.collateral")} value={compactUsd(collateral)} />
        <StatCard label={t(lang, "account.exposure")} value={compactUsd(exposure)} />
        <StatCard
          label={t(lang, "account.upnl")}
          value={signedUsd(uPnl)}
          hint={t(lang, "account.realized", { value: signedUsd(rPnl) })}
          tone={uPnl > 0 ? "up" : uPnl < 0 ? "down" : "default"}
        />
        <StatCard
          label={t(lang, "account.estRealized")}
          value={signedUsd(estRealized)}
          tone={estRealized > 0 ? "up" : estRealized < 0 ? "down" : "default"}
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">
          {t(lang, "address.accounts")}
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-faint">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-medium">{t(lang, "address.index")}</th>
              <th className="px-3 py-2 font-medium">{t(lang, "address.status")}</th>
              <th className="px-3 py-2 font-medium">{t(lang, "account.collateral")}</th>
              <th className="px-3 py-2 font-medium">{t(lang, "address.positions")}</th>
              <th className="px-4 py-2 font-medium">{t(lang, "pos.upnl")}</th>
            </tr>
          </thead>
          <tbody>
            {bundle.accounts.map((a) => {
              const open = a.positions.filter((p) => p.position !== 0);
              const pnl = open.reduce((s, p) => s + p.unrealizedPnl, 0);
              return (
                <tr key={a.index} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/account/${a.index}`} className="font-medium hover:text-accent">
                      {a.index}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {a.status === 1 ? t(lang, "account.active") : t(lang, "account.inactive")}
                  </td>
                  <td className="px-3 py-2 tabular">{compactUsd(a.collateral)}</td>
                  <td className="px-3 py-2 tabular">{open.length}</td>
                  <td className={`px-4 py-2 tabular ${pnlClass(pnl)}`}>{compactUsd(pnl)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {lookupIds.map((id, i) => (
        <AccountHistory
          key={String(id)}
          account={String(id)}
          selves={[id]}
          initial={historyPages[i]}
        />
      ))}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t(lang, "account.openPositions")}</h2>
        <PositionsTable
          positions={allPositions}
          empty={t(lang, "pos.emptyAddress")}
          labels={positionLabels(lang)}
        />
      </section>
    </div>
  );
}
