import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountFunds } from "@/components/account-funds";
import { AccountHistory } from "@/components/account-history";
import { PositionsTable } from "@/components/positions-table";
import {
  Crumbs,
  PageHeader,
  Panel,
  PanelHead,
  Stat,
  StatStrip,
  toneOf,
} from "@/components/ui";
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
import { emptyFundPage, getAccountFundHistory } from "@/lib/funds";
import { explorerLookupId, getAccountTradeHistory } from "@/lib/history";
import { getAccountsByAddress, getMarkets, RhError } from "@/lib/rh";

export const revalidate = 60;

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
  const [historyPages, fundPages] = await Promise.all([
    Promise.all(
      lookupIds.map((id) =>
        getAccountTradeHistory(String(id), 0, 40, [id], marketNames).catch(() => ({
          fills: [],
          nextOffset: 0,
          hasMore: false,
        })),
      ),
    ),
    Promise.all(
      lookupIds.map((id) =>
        getAccountFundHistory(String(id), 0, 40, [id]).catch(() => emptyFundPage()),
      ),
    ),
  ]);
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
    <div className="space-y-3.5">
      <Crumbs
        items={[
          { label: t(lang, "address.crumb") },
          { label: shortAddress(addr, 6) },
        ]}
      />

      <PageHeader
        title={<span className="break-all font-mono text-[17px] sm:text-[19px]">{addr}</span>}
      >
        <span className="badge">
          {t(
            lang,
            bundle.accounts.length === 1 ? "address.linkedOne" : "address.linkedMany",
            { count: bundle.accounts.length },
          )}
        </span>
      </PageHeader>

      <StatStrip cols={5}>
        <Stat
          label={t(lang, "address.accounts")}
          value={String(bundle.accounts.length)}
          hint={t(lang, "address.accountsHint")}
        />
        <Stat
          label={t(lang, "account.collateral")}
          value={compactUsd(collateral)}
          size="lg"
        />
        <Stat label={t(lang, "account.exposure")} value={compactUsd(exposure)} />
        <Stat
          label={t(lang, "account.upnl")}
          value={signedUsd(uPnl)}
          hint={t(lang, "account.realized", { value: signedUsd(rPnl) })}
          tone={toneOf(uPnl)}
        />
        <Stat
          label={t(lang, "account.estRealized")}
          value={signedUsd(estRealized)}
          tone={toneOf(estRealized)}
        />
      </StatStrip>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel className="overflow-hidden">
          <PanelHead title={t(lang, "address.accounts")} />
          <table className="tbl">
            <thead>
              <tr>
                <th>{t(lang, "address.index")}</th>
                <th>{t(lang, "address.status")}</th>
                <th className="num">{t(lang, "account.collateral")}</th>
                <th className="num">{t(lang, "address.positions")}</th>
                <th className="num">{t(lang, "pos.upnl")}</th>
              </tr>
            </thead>
            <tbody>
              {bundle.accounts.map((a) => {
                const open = a.positions.filter((p) => p.position !== 0);
                const pnl = open.reduce((s, p) => s + p.unrealizedPnl, 0);
                return (
                  <tr key={a.index}>
                    <td>
                      <Link
                        href={`/account/${a.index}`}
                        className="font-mono font-medium link-accent"
                      >
                        #{a.index}
                      </Link>
                    </td>
                    <td className="text-muted">
                      {a.status === 1
                        ? t(lang, "account.active")
                        : t(lang, "account.inactive")}
                    </td>
                    <td className="num">{compactUsd(a.collateral)}</td>
                    <td className="num text-muted">{open.length}</td>
                    <td className={`num ${pnlClass(pnl)}`}>{compactUsd(pnl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <section className="space-y-2">
          <h2 className="panel-title">{t(lang, "account.openPositions")}</h2>
          <PositionsTable
            positions={allPositions}
            empty={t(lang, "pos.emptyAddress")}
            labels={positionLabels(lang)}
          />
        </section>
      </div>

      {lookupIds.map((id, i) => (
        <div key={String(id)} className="space-y-3.5">
          {lookupIds.length > 1 ? (
            <p className="eyebrow pt-1">
              {t(lang, "account.hash", { id: String(id) })}
            </p>
          ) : null}
          <AccountHistory
            account={String(id)}
            selves={[id]}
            initial={historyPages[i]}
            anchorId={i === 0 ? "history" : undefined}
          />
          <AccountFunds
            account={String(id)}
            selves={[id]}
            initial={fundPages[i]}
            anchorId={i === 0 ? "funds" : undefined}
          />
        </div>
      ))}
    </div>
  );
}
