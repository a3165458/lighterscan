"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { compactNum, compactUsd } from "@/lib/format";
import {
  TICKER_POLL_MS,
  isTabHidden,
  nextVisiblePollDelay,
} from "@/lib/poll";

type TickerState = {
  dailyVolume: number;
  dailyTrades: number;
  openInterest: number;
  realtime: "direct" | "fresh" | "stale" | "missing";
};

export function StatusTicker() {
  const { t } = useI18n();
  const [state, setState] = useState<TickerState | null>(null);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    function schedule() {
      window.clearTimeout(timer);
      const delay = nextVisiblePollDelay(
        TICKER_POLL_MS,
        document.visibilityState,
      );
      if (delay !== null && active) timer = window.setTimeout(load, delay);
    }

    async function load() {
      if (!active || isTabHidden(document.visibilityState)) return;
      try {
        const response = await fetch("/api/ticker");
        const value = (await response.json()) as TickerState;
        if (active && response.ok) setState(value);
      } catch {
        if (active) setState(null);
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
  }, []);

  const realtime = state?.realtime ?? "missing";
  const live = realtime === "fresh" || realtime === "direct";
  const label =
    realtime === "fresh" || realtime === "direct"
      ? t("ticker.live")
      : realtime === "stale"
        ? t("ticker.stale")
        : t("ticker.missing");

  const metrics = [
    { label: t("ticker.volume"), value: state ? compactUsd(state.dailyVolume) : "—" },
    { label: t("ticker.oi"), value: state ? compactUsd(state.openInterest) : "—" },
    { label: t("ticker.trades"), value: state ? compactNum(state.dailyTrades, 0) : "—" },
  ];

  return (
    <div className="border-b border-line bg-elev/60 text-[11px]">
      <div className="section-nav mx-auto max-w-[1440px] items-center gap-x-4 px-3 py-1 tabular sm:px-4">
        <span
          className={`flex h-5 shrink-0 items-center gap-1.5 font-medium tracking-wide ${
            live ? "text-up" : "text-faint"
          }`}
        >
          <span className={live ? "live-dot" : "dot-off"} />
          {label}
        </span>
        <span className="h-3 w-px shrink-0 bg-line" aria-hidden />
        {metrics.map((metric) => (
          <span key={metric.label} className="flex shrink-0 items-baseline gap-1.5 text-faint">
            {metric.label}
            <span className="font-medium text-muted">{metric.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
