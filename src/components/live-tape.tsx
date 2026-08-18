"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { compactUsd, formatPrice, formatSize, formatTimeOnly } from "@/lib/format";
import { RH_WS } from "@/lib/config";
import { resolveLiveStatus } from "@/lib/live-status";
import { tradeLogHref } from "@/lib/account-stats";
import {
  isPublicRealtimeSnapshot,
  parseLighterTradeMessage,
} from "@/lib/realtime";
import {
  LIVE_POLL_MS,
  isTabHidden,
  nextVisiblePollDelay,
} from "@/lib/poll";
import { filterTapeTrades, TAPE_MIN_OPTIONS, type TapeMin } from "@/lib/tape-filter";
import type { Trade } from "@/lib/types";

type Seed = { marketId: number; symbol: string };

export function LiveTape({
  markets,
  title = "Live Trades",
  max = 48,
  seed = [],
  transport = "direct",
  minUsd = 0,
  showFilter = false,
  height = "32rem",
}: {
  markets: Seed[];
  title?: string;
  max?: number;
  seed?: Trade[];
  transport?: "direct" | "shared";
  minUsd?: TapeMin;
  showFilter?: boolean;
  height?: string;
}) {
  const { t } = useI18n();
  const [trades, setTrades] = useState<Trade[]>(seed);
  const [min, setMin] = useState<TapeMin>(minUsd);
  const [status, setStatus] = useState<"connecting" | "live" | "idle">(
    seed.length > 0 ? "live" : "connecting",
  );
  const map = useMemo(
    () => new Map(markets.map((m) => [m.marketId, m.symbol])),
    [markets],
  );
  const ids = useMemo(() => markets.map((m) => m.marketId), [markets]);
  const idSet = useMemo(() => new Set(ids), [ids]);
  const ping = useRef<number | null>(null);
  const flushTimer = useRef<number | null>(null);
  const pendingTrades = useRef<Trade[]>([]);

  useEffect(() => {
    if (transport !== "shared" || ids.length === 0) return;
    let active = true;
    let timer: number | undefined;

    function schedule() {
      window.clearTimeout(timer);
      const delay = nextVisiblePollDelay(LIVE_POLL_MS, document.visibilityState);
      if (delay !== null && active) timer = window.setTimeout(load, delay);
    }

    async function load() {
      if (!active || isTabHidden(document.visibilityState)) return;
      try {
        const response = await fetch("/api/live");
        const value = (await response.json()) as unknown;
        if (!response.ok || !isPublicRealtimeSnapshot(value)) {
          throw new Error("Realtime snapshot unavailable");
        }
        if (!active) return;
        setTrades(
          value.trades.filter((trade) => idSet.has(trade.marketId)).slice(0, max),
        );
        setStatus(
          (value as typeof value & { fresh?: boolean }).fresh
            ? "live"
            : "connecting",
        );
      } catch {
        if (active) setStatus("connecting");
      } finally {
        if (active) schedule();
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void load();
      else window.clearTimeout(timer);
    }

    document.addEventListener("visibilitychange", onVisibility);
    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [idSet, ids.length, max, transport]);

  useEffect(() => {
    if (transport === "shared" || !ids.length) {
      return;
    }
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;

    function connect() {
      if (closed) return;
      setStatus((prev) => (prev === "live" || seed.length > 0 ? "live" : "connecting"));
      ws = new WebSocket(RH_WS);
      ws.onopen = () => {
        retry = 0;
        setStatus("live");
        for (const id of ids) {
          ws?.send(JSON.stringify({ type: "subscribe", channel: `trade/${id}` }));
        }
        ping.current = window.setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 45_000);
      };
      ws.onmessage = (ev) => {
        try {
          const mapped = parseLighterTradeMessage(
            JSON.parse(ev.data as string) as unknown,
            map,
          );
          if (mapped.length === 0) return;
          pendingTrades.current.push(...mapped);
          if (flushTimer.current === null) {
            flushTimer.current = window.setTimeout(() => {
              const batch = pendingTrades.current.reverse();
              pendingTrades.current = [];
              flushTimer.current = null;
              setTrades((prev) => [...batch, ...prev].slice(0, max));
            }, 100);
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (ping.current) window.clearInterval(ping.current);
        if (closed) return;
        retry += 1;
        window.setTimeout(connect, Math.min(8_000, 800 * retry));
      };
    }

    connect();
    return () => {
      closed = true;
      if (ping.current) window.clearInterval(ping.current);
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
      pendingTrades.current = [];
      ws?.close();
    };
  }, [ids, map, max, seed.length, transport]);

  const visible = filterTapeTrades(trades, { minUsd: min });
  const shown = ids.length === 0 ? "idle" : resolveLiveStatus(status, trades.length > 0);

  return (
    <section className="panel flex flex-col overflow-hidden">
      <div className="panel-head">
        <h2 className="panel-title">{title || t("tape.title")}</h2>
        <div className="flex items-center gap-2">
          {showFilter ? (
            <div className="seg">
              {TAPE_MIN_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  data-on={min === value}
                  onClick={() => setMin(value)}
                >
                  {value === 0 ? t("tape.minAny") : compactUsd(value)}
                </button>
              ))}
            </div>
          ) : null}
          <span
            className={`badge ${shown === "live" ? "badge-up" : ""}`}
            title={t("tape.hint")}
          >
            <span className={shown === "live" ? "live-dot" : "dot-off"} />
            {shown === "live"
              ? t("tape.live")
              : shown === "connecting"
                ? t("tape.connecting")
                : t("tape.idle")}
          </span>
        </div>
      </div>
      <div
        className="flex items-center gap-2 border-b border-line px-3 py-1"
        aria-hidden
      >
        <span className="eyebrow w-[56px]">{t("table.market")}</span>
        <span className="eyebrow min-w-0 flex-1">{t("account.side")}</span>
        <span className="eyebrow w-[74px] text-right">{t("account.notional")}</span>
      </div>
      <div className="scroll-y min-h-0 flex-1" style={{ maxHeight: height }}>
        {visible.length === 0 ? (
          <p className="empty">
            {trades.length ? t("tape.emptyFilter") : t("tape.waiting")}
          </p>
        ) : (
          <ul>
            {visible.map((fill) => {
              const href = tradeLogHref(fill.txHash);
              const rowClass =
                "deferred-row flex items-center gap-2 px-3 py-[5px] text-[12.5px]";
              const body = (
                <>
                  <span className="w-[56px] shrink-0 truncate font-medium">
                    {fill.symbol || fill.marketId}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span
                      className={`w-[22px] shrink-0 font-medium ${fill.takerIsAsk ? "text-down" : "text-up"}`}
                    >
                      {fill.takerIsAsk ? t("tape.sell") : t("tape.buy")}
                    </span>
                    <span className="truncate tabular text-muted">
                      {formatSize(fill.size)}
                    </span>
                    <span className="tabular">{formatPrice(fill.price)}</span>
                    {fill.type !== "trade" ? (
                      <span className="tag shrink-0">{fill.type}</span>
                    ) : null}
                  </span>
                  <span className="w-[74px] shrink-0 text-right">
                    <span className="block tabular">{compactUsd(fill.usdAmount)}</span>
                    <span className="block text-[10.5px] tabular text-faint">
                      {formatTimeOnly(fill.timestamp)}
                    </span>
                  </span>
                </>
              );
              return (
                <li
                  key={`${fill.tradeId}-${fill.timestamp}`}
                  className="border-b border-line/60 last:border-0"
                >
                  {href ? (
                    <Link href={href} className={`${rowClass} hover:bg-hover`}>
                      {body}
                    </Link>
                  ) : (
                    <div className={rowClass}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
