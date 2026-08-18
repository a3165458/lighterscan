import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LANG, parseLang, t } from "./i18n.ts";
import { DEFAULT_THEME, parseTheme, THEME_COOKIE } from "./theme.ts";

test("English key resolves to English chrome, not the key", () => {
  assert.equal(t("en", "nav.markets"), "Markets");
  assert.equal(t("en", "nav.trackers"), "Trackers");
  assert.equal(t("en", "home.perpVolume"), "Perp Volume");
  assert.notEqual(t("en", "nav.markets"), "nav.markets");
});

test("Chinese key resolves to Chinese chrome", () => {
  assert.equal(t("zh", "nav.markets"), "市场");
  assert.equal(t("zh", "nav.leaderboard"), "积分");
  assert.equal(t("zh", "nav.tape"), "实时成交");
  assert.equal(t("zh", "nav.trackers"), "大户追踪");
  assert.equal(t("zh", "home.title"), "市场、账户与成交流");
  assert.equal(t("zh", "search.button"), "搜索账户…");
  assert.equal(t("zh", "search.close"), "关闭");
  assert.equal(t("zh", "history.pnl"), "预估盈亏");
  assert.equal(t("zh", "funds.title"), "出入金");
  assert.equal(t("zh", "funds.deposit"), "入金");
  assert.equal(t("zh", "funds.withdraw"), "出金");
  assert.equal(t("zh", "funds.transfer"), "转账");
  assert.equal(t("en", "funds.title"), "Deposits & withdrawals");
  assert.equal(t("en", "funds.deposit"), "Deposit");
  assert.equal(t("zh", "account.estRealized"), "预估已实现");
  assert.equal(t("zh", "stats.volumeCurve"), "小时成交额");
  assert.equal(t("zh", "filter.all"), "全部");
  assert.equal(t("zh", "liq.emptyMarket", { market: "BTC" }), "没有 BTC 的公开清算。");
  assert.notEqual(t("zh", "stats.empty"), "采集器写入第一个小时后才会出现曲线。");
  assert.equal(t("zh", "tracker.sample"), "累计观察");
  assert.match(t("zh", "tracker.subtitle"), /最早一笔记到现在/);
  assert.equal(t("zh", "tape.live"), "实时");
  assert.equal(t("zh", "tape.connecting"), "连接中");
  assert.equal(t("zh", "account.historyPartial", { count: 1500 }), "已汇总前 1500 笔历史成交");
  assert.notEqual(t("zh", "nav.markets"), t("en", "nav.markets"));
});

test("interpolation fills placeholders", () => {
  assert.equal(t("zh", "home.marketsHint", { perp: 40, spot: 26 }), "40 永续 · 26 现货");
  assert.equal(t("en", "account.title", { id: 1913 }), "Account 1913");
});

test("parseLang defaults to Chinese and accepts en/zh aliases", () => {
  assert.equal(DEFAULT_LANG, "zh");
  assert.equal(parseLang(undefined), "zh");
  assert.equal(parseLang("en-US"), "en");
  assert.equal(parseLang("zh-CN"), "zh");
  assert.equal(parseLang("english"), "en");
});

test("parseTheme keeps an explicit light or dark choice", () => {
  assert.equal(DEFAULT_THEME, "dark");
  assert.equal(THEME_COOKIE, "ls-theme");
  assert.equal(parseTheme("light"), "light");
  assert.equal(parseTheme("dark"), "dark");
  assert.equal(parseTheme("LIGHT"), "light");
  assert.equal(parseTheme("system"), "dark");
  assert.equal(parseTheme(undefined), "dark");
});
