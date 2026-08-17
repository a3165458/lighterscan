"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { compactNum, compactUsd } from "@/lib/format";

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
    async function load() {
      try {
        const response = await fetch("/api/ticker");
        const value = (await response.json()) as TickerState;
        if (active && response.ok) setState(value);
      } catch {
        if (active) setState(null);
      } finally {
        if (active) timer = window.setTimeout(load, 8_000);
      }
    }
    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
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

  return (
    <div className="border-b border-line bg-elev/70 text-[11px]">
      <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-4 py-1.5 tabular">
        <span className="flex shrink-0 items-center gap-1.5 font-medium">
          <span className={live ? "live-dot" : "h-1.5 w-1.5 rounded-full bg-faint"} />
          {label}
        </span>
        <span className="text-muted">
          {t("ticker.volume")}{" "}
          <span className="text-ink">{state ? compactUsd(state.dailyVolume) : "—"}</span>
        </span>
        <span className="text-muted">
          {t("ticker.oi")}{" "}
          <span className="text-ink">{state ? compactUsd(state.openInterest) : "—"}</span>
        </span>
        <span className="text-muted">
          {t("ticker.trades")}{" "}
          <span className="text-ink">{state ? compactNum(state.dailyTrades, 0) : "—"}</span>
        </span>
      </div>
    </div>
  );
}
