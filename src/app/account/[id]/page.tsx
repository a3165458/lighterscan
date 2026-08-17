import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountHistory } from "@/components/account-history";
import { AccountLive } from "@/components/account-live";
import { PositionsTable } from "@/components/positions-table";
import { StatCard } from "@/components/stat-card";
import {
  canLinkAddress,
  compactUsd,
  formatDate,
  pnlClass,
  shortAddress,
  signedUsd,
} from "@/lib/format";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { estimateFillPnls, sumRealized } from "@/lib/pnl";
import { positionLabels } from "@/lib/position-labels";
import { getAccountTradeHistory, getAccountVolumeStats } from "@/lib/history";
import { getAccountByIndex, getMarkets, RhError } from "@/lib/rh";

export const revalidate = 8;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Account ${id}` };
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountIndex = Number(id);
  if (!Number.isSafeInteger(accountIndex) || accountIndex < 0) notFound();
  const lang = await getRequestLang();
  const marketsPromise = getMarkets().catch(() => []);
  let bundle;
  try {
    bundle = await getAccountByIndex(id);
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
    if (status === 404 || (err instanceof RhError && err.status === 404)) notFound();
    const markets = await marketsPromise;
    const marketNames = Object.fromEntries(
      markets.map((market) => [market.marketId, market.symbol]),
    );
    const [history, volume] = await Promise.all([
      getAccountTradeHistory(
        id,
        0,
        40,
        [accountIndex],
        marketNames,
      ).catch(() => ({ fills: [], nextOffset: 0, hasMore: false })),
      getAccountVolumeStats(id, [accountIndex]).catch(() => null),
    ]);
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t(lang, "account.title", { id: accountIndex })}
        </h1>
        <AccountLive
          key={accountIndex}
          accountIndex={accountIndex}
          initial={volume?.stats ?? null}
          complete={volume?.complete ?? true}
        />
        <AccountHistory
          account={id}
          selves={[accountIndex]}
          initial={history}
        />
      </div>
    );
  }
  const { primary, accounts } = bundle;
  const open = primary.positions.filter((p) => p.position !== 0);
  const uPnl = open.reduce((s, p) => s + p.unrealizedPnl, 0);
  const rPnl = open.reduce((s, p) => s + p.realizedPnl, 0);
  const exposure = open.reduce((s, p) => s + Math.abs(p.positionValue), 0);
  const markets = await marketsPromise;
  const marketNames = Object.fromEntries(markets.map((m) => [m.marketId, m.symbol]));
  const [history, volume] = await Promise.all([
    getAccountTradeHistory(
      String(primary.index),
      0,
      40,
      [primary.index],
      marketNames,
    ).catch(() => ({ fills: [], nextOffset: 0, hasMore: false })),
    getAccountVolumeStats(String(primary.index), [primary.index]).catch(() => null),
  ]);
  const estRealized = sumRealized(estimateFillPnls(history.fills));

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted">
        <Link href="/leaderboard" className="hover:text-ink">
          {t(lang, "account.crumb")}
        </Link>
        <span className="mx-1.5 text-faint">/</span>
        {t(lang, "account.hash", { id: primary.index })}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t(lang, "account.title", { id: primary.index })}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {primary.name ? `${primary.name} · ` : ""}
            {primary.status === 1 ? t(lang, "account.active") : t(lang, "account.inactive")}
            {primary.createdAt
              ? ` · ${t(lang, "account.created", { date: formatDate(primary.createdAt) })}`
              : ""}
          </p>
          {primary.l1Address && canLinkAddress(primary.l1Address) ? (
            <Link
              href={`/address/${primary.l1Address}`}
              className="mt-1 inline-block font-mono text-sm text-accent hover:underline"
            >
              {shortAddress(primary.l1Address, 6)}
            </Link>
          ) : primary.l1Address ? (
            <span className="mt-1 inline-block font-mono text-sm text-muted">
              {shortAddress(primary.l1Address, 6)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={t(lang, "account.collateral")}
          value={compactUsd(primary.collateral)}
          hint={t(lang, "account.collateralHint")}
        />
        <StatCard
          label={t(lang, "account.available")}
          value={compactUsd(primary.availableBalance)}
          hint={t(lang, "account.pending", { count: primary.pendingOrderCount })}
        />
        <StatCard
          label={t(lang, "account.exposure")}
          value={compactUsd(exposure)}
          hint={t(lang, "account.positionsCount", { count: open.length })}
        />
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

      <AccountLive
        key={primary.index}
        accountIndex={primary.index}
        initial={volume?.stats ?? null}
        complete={volume?.complete ?? true}
      />

      <AccountHistory
        account={String(primary.index)}
        selves={[primary.index]}
        initial={history}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t(lang, "account.openPositions")}</h2>
        <PositionsTable
          positions={primary.positions}
          empty={t(lang, "pos.empty")}
          labels={positionLabels(lang)}
        />
      </section>

      {history.fills.some((fill) => /liquidat/i.test(fill.kind)) ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">
            {t(lang, "account.liqs")}
          </div>
          <ul>
            {history.fills
              .filter((fill) => /liquidat/i.test(fill.kind))
              .slice(0, 12)
              .map((fill) => (
                <li
                  key={`${fill.hash}-${fill.timestamp}`}
                  className="flex items-center justify-between border-b border-line px-4 py-2 text-sm last:border-0"
                >
                  <span>{fill.symbol || fill.marketId}</span>
                  <span className="tabular">{compactUsd(fill.usdAmount)}</span>
                  <Link href={`/logs/${fill.hash}`} className="font-mono text-xs text-muted">
                    {fill.hash.slice(0, 10)}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {primary.assets.length ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">
            {t(lang, "account.assets")}
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-faint">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">{t(lang, "account.asset")}</th>
                <th className="px-3 py-2 font-medium">{t(lang, "account.balance")}</th>
                <th className="px-4 py-2 font-medium">{t(lang, "account.locked")}</th>
              </tr>
            </thead>
            <tbody>
              {primary.assets.map((a) => (
                <tr key={a.assetId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">{a.symbol}</td>
                  <td className="px-3 py-2 tabular">{a.balance}</td>
                  <td className="px-4 py-2 tabular text-muted">{a.lockedBalance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {accounts.length > 1 ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">{t(lang, "account.linked")}</h2>
            <p className="text-xs text-muted">{t(lang, "account.linkedHint")}</p>
          </div>
          <ul>
            {accounts.map((a) => (
              <li key={a.index} className="border-b border-line last:border-0">
                <Link
                  href={`/account/${a.index}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-hover"
                >
                  <span className="font-medium">
                    #{a.index}
                    {a.index === primary.index ? (
                      <span className="ml-2 text-[11px] text-accent">
                        {t(lang, "account.this")}
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular text-muted">
                    {compactUsd(a.collateral)}
                    <span className={`ml-3 ${pnlClass(a.positions.reduce((s, p) => s + p.unrealizedPnl, 0))}`}>
                      {compactUsd(a.positions.reduce((s, p) => s + p.unrealizedPnl, 0))}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
