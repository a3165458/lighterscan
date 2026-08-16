import { t, type Lang } from "@/lib/i18n";

export function positionLabels(lang: Lang) {
  return {
    market: t(lang, "pos.market"),
    side: t(lang, "pos.side"),
    size: t(lang, "pos.size"),
    entry: t(lang, "pos.entry"),
    value: t(lang, "pos.value"),
    upnl: t(lang, "pos.upnl"),
    rpnl: t(lang, "pos.rpnl"),
    liq: t(lang, "pos.liq"),
    long: t(lang, "pos.long"),
    short: t(lang, "pos.short"),
  };
}
