"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { GITHUB_REPO, RH_TRADE } from "@/lib/config";

function GitHubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
    </svg>
  );
}
import { useSyncExternalStore } from "react";
import { StatusTicker } from "@/components/status-ticker";
import { useI18n } from "@/components/i18n-provider";
import { SearchBox, SearchProvider } from "@/components/search";
import type { Lang } from "@/lib/i18n";
import { THEME_COOKIE } from "@/lib/theme";

function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("light");
}

function getServerThemeSnapshot() {
  return false;
}

function ThemeToggle() {
  const { t } = useI18n();
  const light = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  return (
    <button
      type="button"
      aria-label={light ? t("theme.toDark") : t("theme.toLight")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-elev text-muted hover:text-ink"
      onClick={() => {
        const next = !document.documentElement.classList.contains("light");
        document.documentElement.classList.toggle("light", next);
        const theme = next ? "light" : "dark";
        try {
          localStorage.setItem(THEME_COOKIE, theme);
        } catch {
          /* ignore */
        }
        document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
      }}
    >
      {light ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}

function LangToggle() {
  const { lang, setLang, t } = useI18n();
  const next: Lang = lang === "zh" ? "en" : "zh";
  return (
    <button
      type="button"
      aria-label={lang === "zh" ? "Switch to English" : "切换到中文"}
      className="inline-flex h-9 items-center rounded-full border border-line bg-elev px-2.5 text-xs font-medium text-muted hover:text-ink"
      onClick={() => setLang(next)}
    >
      {lang === "zh" ? t("lang.en") : t("lang.zh")}
    </button>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const nav = [
    { href: "/", label: t("nav.markets") },
    { href: "/liquidations", label: t("nav.liquidations") },
    { href: "/positions", label: t("nav.positions") },
    { href: "/trackers", label: t("nav.trackers") },
    { href: "/tape", label: t("nav.tape") },
    { href: "/stats", label: t("nav.stats") },
    { href: "/leaderboard", label: t("nav.leaderboard") },
  ];

  return (
    <SearchProvider>
      <div className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-bg">
                L
              </span>
              <span className="text-[15px] font-semibold tracking-tight">LighterScan</span>
            </Link>
            <span className="hidden rounded-full border border-line bg-elev px-2 py-0.5 text-[11px] font-medium text-muted sm:inline">
              Robinhood Lighter
            </span>
            <nav className="ml-2 hidden items-center gap-1 md:flex">
              {nav.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      active ? "bg-hover text-ink" : "text-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <SearchBox compact />
              <a
                href={RH_TRADE}
                target="_blank"
                rel="noreferrer"
                className="hidden rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-bg sm:inline"
              >
                {t("nav.trade")}
              </a>
              <LangToggle />
              <ThemeToggle />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 md:hidden">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1 text-sm ${
                    active ? "bg-hover text-ink" : "text-muted"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <StatusTicker />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted">
            <span>{t("footer.right")}</span>
            <div className="flex items-center gap-3">
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noreferrer"
                aria-label={t("footer.github")}
                className="inline-flex items-center gap-1.5 hover:text-ink"
              >
                <GitHubIcon />
                <span>GitHub</span>
              </a>
              <a href={RH_TRADE} target="_blank" rel="noreferrer" className="hover:text-ink">
                {t("footer.trade")}
              </a>
            </div>
          </div>
        </footer>
      </div>
    </SearchProvider>
  );
}
