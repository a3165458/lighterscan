import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountFunds } from "@/components/account-funds";
import { AccountHistory } from "@/components/account-history";
import { AccountLive } from "@/components/account-live";
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
  formatDate,
  pnlClass,
  shortAddress,
  signedUsd,
} from "@/lib/format";
import { t, type Lang, type MsgKey } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { estimateFillPnls, sumRealized } from "@/lib/pnl";
import { positionLabels } from "@/lib/position-labels";
import { emptyFundPage, getAccountFundHistory } from "@/lib/funds";
import { getAccountTradeHistory, getAccountVolumeStats } from "@/lib/history";
import { getAccountByIndex, getMarkets, RhError } from "@/lib/rh";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Account ${id}` };
}

function SectionNav({
  lang,
  items,
}: {
  lang: Lang;
  items: { href: string; key: MsgKey }[];
}) {
  return (
    <nav className="section-nav gap-1.5 pt-0.5">
      {items.map((item) => (
        <a key={item.href} href={item.href} className="btn btn-xs text-muted">
          {t(lang, item.key)}
        </a>
      ))}
    </nav>
  );
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
    const [history, funds, volume] = await Promise.all([
      getAccountTradeHistory(
        id,
        0,
        40,
        [accountIndex],
        marketNames,
      ).catch(() => ({ fills: [], nextOffset: 0, hasMore: false })),
      getAccountFundHistory(id, 0, 40, [accountIndex]).catch(() =>
        emptyFundPage(),
      ),
      getAccountVolumeStats(id, [accountIndex]).catch(() => null),
    ]);
    return (
      <div className="space-y-3.5">
        <PageHeader title={t(lang, "account.title", { id: accountIndex })} />
        <AccountLive
          key={accountIndex}
          accountIndex={accountIndex}
          initial={volume?.stats ?? null}
          complete={volume?.complete ?? true}
        />
        <SectionNav
          lang={lang}
          items={[
            { href: "#history", key: "history.title" },
            { href: "#funds", key: "funds.title" },
          ]}
        />
        <AccountHistory
          account={id}
          selves={[accountIndex]}
          initial={history}
          anchorId="history"
        />
        <AccountFunds
          account={id}
          selves={[accountIndex]}
          initial={funds}
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
  const [history, funds, volume] = await Promise.all([
    getAccountTradeHistory(
      String(primary.index),
      0,
      40,
      [primary.index],
      marketNames,
    ).catch(() => ({ fills: [], nextOffset: 0, hasMore: false })),
    getAccountFundHistory(
      String(primary.index),
      0,
      40,
      [primary.index],
    ).catch(() => emptyFundPage()),
    getAccountVolumeStats(String(primary.index), [primary.index]).catch(() => null),
  ]);
  const estRealized = sumRealized(estimateFillPnls(history.fills));
  const liquidations = history.fills.filter((fill) => /liquidat/i.test(fill.kind));
  const sections: { href: string; key: MsgKey }[] = [
    { href: "#positions", key: "account.openPositions" },
    { href: "#history", key: "history.title" },
    { href: "#funds", key: "funds.title" },
  ];
  if (primary.assets.length) sections.push({ href: "#assets", key: "account.assets" });
  if (accounts.length > 1) sections.push({ href: "#linked", key: "account.linked" });

  return (
    <div className="space-y-3.5">
      <Crumbs
        items={[
          { label: t(lang, "account.crumb"), href: "/leaderboard" },
          { label: t(lang, "account.hash", { id: primary.index }) },
        ]}
      />

      <PageHeader title={t(lang, "account.title", { id: primary.index })}>
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <span className={`badge ${primary.status === 1 ? "badge-up" : ""}`}>
            {primary.status === 1
              ? t(lang, "account.active")
              : t(lang, "account.inactive")}
          </span>
          {primary.name ? <span className="badge">{primary.name}</span> : null}
          {primary.createdAt ? (
            <span className="badge">
              {t(lang, "account.created", { date: formatDate(primary.createdAt) })}
            </span>
          ) : null}
          {primary.l1Address && canLinkAddress(primary.l1Address) ? (
            <Link
              href={`/address/${primary.l1Address}`}
              className="badge font-mono text-accent hover:underline"
            >
              {shortAddress(primary.l1Address, 6)}
            </Link>
          ) : primary.l1Address ? (
            <span className="badge font-mono">{shortAddress(primary.l1Address, 6)}</span>
          ) : null}
        </div>
      </PageHeader>

      <AccountLive
        key={primary.index}
        accountIndex={primary.index}
        initial={volume?.stats ?? null}
        complete={volume?.complete ?? true}
      />

      <StatStrip cols={5}>
        <Stat
          label={t(lang, "account.collateral")}
          value={compactUsd(primary.collateral)}
          hint={t(lang, "account.collateralHint")}
        />
        <Stat
          label={t(lang, "account.available")}
          value={compactUsd(primary.availableBalance)}
          hint={t(lang, "account.pending", { count: primary.pendingOrderCount })}
        />
        <Stat
          label={t(lang, "account.exposure")}
          value={compactUsd(exposure)}
          hint={t(lang, "account.positionsCount", { count: open.length })}
        />
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

      <SectionNav lang={lang} items={sections} />

      <section id="positions" className="space-y-2 scroll-mt-24">
        <h2 className="panel-title">{t(lang, "account.openPositions")}</h2>
        <PositionsTable
          positions={primary.positions}
          empty={t(lang, "pos.empty")}
          labels={positionLabels(lang)}
        />
      </section>

      <AccountHistory
        account={String(primary.index)}
        selves={[primary.index]}
        initial={history}
        anchorId="history"
      />

      <AccountFunds
        account={String(primary.index)}
        selves={[primary.index]}
        initial={funds}
      />

      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        {liquidations.length ? (
          <Panel className="overflow-hidden">
            <PanelHead title={t(lang, "account.liqs")} />
            <table className="tbl">
              <tbody>
                {liquidations.slice(0, 12).map((fill) => (
                  <tr key={`${fill.hash}-${fill.timestamp}`}>
                    <td className="font-medium">{fill.symbol || fill.marketId}</td>
                    <td className="num">{compactUsd(fill.usdAmount)}</td>
                    <td className="num">
                      <Link
                        href={`/logs/${fill.hash}`}
                        className="font-mono text-[11px] text-faint link-accent"
                      >
                        {fill.hash.slice(0, 10)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ) : null}

        {primary.assets.length ? (
          <Panel id="assets" className="overflow-hidden scroll-mt-24">
            <PanelHead title={t(lang, "account.assets")} />
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t(lang, "account.asset")}</th>
                  <th className="num">{t(lang, "account.balance")}</th>
                  <th className="num">{t(lang, "account.locked")}</th>
                </tr>
              </thead>
              <tbody>
                {primary.assets.map((a) => (
                  <tr key={a.assetId}>
                    <td className="font-medium">{a.symbol}</td>
                    <td className="num">{a.balance}</td>
                    <td className="num text-muted">{a.lockedBalance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ) : null}

        {accounts.length > 1 ? (
          <Panel id="linked" className="overflow-hidden scroll-mt-24">
            <PanelHead
              title={t(lang, "account.linked")}
              hint={t(lang, "account.linkedHint")}
            />
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t(lang, "address.index")}</th>
                  <th className="num">{t(lang, "account.collateral")}</th>
                  <th className="num">{t(lang, "pos.upnl")}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const pnl = a.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
                  return (
                    <tr key={a.index}>
                      <td>
                        <Link
                          href={`/account/${a.index}`}
                          className="font-mono font-medium link-accent"
                        >
                          #{a.index}
                        </Link>
                        {a.index === primary.index ? (
                          <span className="ml-1.5 text-[10.5px] text-accent">
                            {t(lang, "account.this")}
                          </span>
                        ) : null}
                      </td>
                      <td className="num">{compactUsd(a.collateral)}</td>
                      <td className={`num ${pnlClass(pnl)}`}>{compactUsd(pnl)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
