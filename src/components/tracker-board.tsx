"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { compactNum, compactUsd, formatTime, normalizeTs } from "@/lib/format";
import { RH_WS } from "@/lib/config";
import { resolveLiveStatus } from "@/lib/live-status";
import {
  isPublicRealtimeSnapshot,
  parseLighterTradeMessage,
  type PublicRealtimeSnapshot,
} from "@/lib/realtime";
import { rankTrackedAccounts } from "@/lib/tracker-metrics";
import type { TrackedMarket } from "@/lib/trackers";
import type { Trade } from "@/lib/types";

const MAX_OBSERVED_TRADES = 1_200;


export function TrackerBoard({
  markets,
  transport = "direct",
}: {
  markets: TrackedMarket[];
  transport?: "direct" | "shared";
}) {
  const { t } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "idle">(
    markets.length > 0 ? "connecting" : "idle",
  );
  const [sharedTrackers, setSharedTrackers] = useState<
    PublicRealtimeSnapshot["trackers"] | null
  >(null);
  const marketNames = useMemo(
    () => new Map(markets.map((market) => [market.marketId, market.symbol])),
    [markets],
  );
  const marketIds = useMemo(
    () => markets.map((market) => market.marketId),
    [markets],
  );
  const pingTimer = useRef<number | null>(null);
  const flushTimer = useRef<number | null>(null);
  const pendingTrades = useRef<Trade[]>([]);

  useEffect(() => {
    if (transport !== "shared" || marketIds.length === 0) return;
    let active = true;
    let timer: number | undefined;

    async function load() {
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        const value = (await response.json()) as unknown;
        if (!response.ok || !isPublicRealtimeSnapshot(value)) {
          throw new Error("Realtime snapshot unavailable");
        }
        if (!active) return;
        setSharedTrackers(value.trackers);
        setStatus(
          (value as typeof value & { fresh?: boolean }).fresh
            ? "live"
            : "connecting",
        );
      } catch {
        if (active) setStatus("connecting");
      } finally {
        if (active) timer = window.setTimeout(load, 2_000);
      }
    }

    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [marketIds.length, transport]);

  useEffect(() => {
    if (transport === "shared" || marketIds.length === 0) return;
    let socket: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let retryTimer: number | null = null;

    function connect() {
      if (closed) return;
      socket = new WebSocket(RH_WS);
      socket.onopen = () => {
        retry = 0;
        setStatus("live");
        for (const marketId of marketIds) {
          socket?.send(
            JSON.stringify({ type: "subscribe", channel: `trade/${marketId}` }),
          );
        }
        pingTimer.current = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 45_000);
      };
      socket.onmessage = (event) => {
        try {
          const incoming = parseLighterTradeMessage(
            JSON.parse(event.data as string) as unknown,
            marketNames,
          ).map((trade) => ({
            ...trade,
            timestamp: normalizeTs(trade.timestamp),
          }));
          if (incoming.length === 0) return;
          pendingTrades.current.push(...incoming);
          if (flushTimer.current === null) {
            flushTimer.current = window.setTimeout(() => {
              const batch = pendingTrades.current.reverse();
              pendingTrades.current = [];
              flushTimer.current = null;
              setTrades((previous) =>
                [...batch, ...previous].slice(0, MAX_OBSERVED_TRADES),
              );
            }, 100);
          }
        } catch {
          /* Ignore malformed public stream frames. */
        }
      };
      socket.onclose = () => {
        if (pingTimer.current !== null) {
          window.clearInterval(pingTimer.current);
          pingTimer.current = null;
        }
        if (closed) return;
        setStatus("connecting");
        retry += 1;
        retryTimer = window.setTimeout(
          connect,
          Math.min(8_000, 800 * retry),
        );
      };
    }

    connect();
    return () => {
      closed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (pingTimer.current !== null) window.clearInterval(pingTimer.current);
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
      pendingTrades.current = [];
      socket?.close();
    };
  }, [marketIds, marketNames, transport]);

  const ranking = useMemo(
    () => sharedTrackers ?? rankTrackedAccounts(trades, 20),
    [sharedTrackers, trades],
  );
  const rows = ranking.whales;
  const observationWindow = useMemo(() => {
    if (sharedTrackers) {
      return {
        start: sharedTrackers.windowStart,
        end: sharedTrackers.windowEnd,
      };
    }
    let start = Number.POSITIVE_INFINITY;
    let end = 0;
    for (const trade of trades) {
      start = Math.min(start, trade.timestamp);
      end = Math.max(end, trade.timestamp);
    }
    return {
      start: Number.isFinite(start) ? start : 0,
      end,
    };
  }, [sharedTrackers, trades]);
  const sampledTrades = sharedTrackers?.sampledTrades ?? trades.length;
  const observedMarkets =
    sharedTrackers?.markets ?? markets.map((market) => market.symbol);
  const shownStatus =
    marketIds.length === 0
      ? "idle"
      : resolveLiveStatus(status, trades.length > 0);

  return (
    <>
      <section className="panel grid gap-3 px-4 py-3 text-xs text-muted sm:grid-cols-3">
        <div>
          <div className="text-faint">{t("tracker.sample")}</div>
          <div className="mt-1 text-sm text-ink">
            {t("tracker.sampleValue", {
              trades: compactNum(sampledTrades, 0),
              markets: observedMarkets.length,
            })}
          </div>
        </div>
        <div>
          <div className="text-faint">{t("tracker.window")}</div>
          <div className="mt-1 text-sm text-ink">
            {observationWindow.start && observationWindow.end
              ? `${formatTime(observationWindow.start)} – ${formatTime(observationWindow.end)}`
              : t("tracker.collecting")}
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-faint">{t("tracker.markets")}</div>
            <div
              className="mt-1 truncate text-sm text-ink"
              title={observedMarkets.join(" · ")}
            >
              {observedMarkets.join(" · ") || "—"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2" aria-live="polite">
            <span
              className={
                shownStatus === "live"
                  ? "live-dot"
                  : "h-1.5 w-1.5 rounded-full bg-faint"
              }
            />
            {shownStatus === "live"
              ? t("tape.live")
              : shownStatus === "connecting"
                ? t("tape.connecting")
                : t("tape.idle")}
          </div>
        </div>
      </section>

      <div className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{t("tracker.whaleTitle")}</h2>
        </div>
        {markets.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {t("tracker.loadFail")}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted" aria-live="polite">
            {t("tracker.collecting")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-16" />
                <col className="w-28" />
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
