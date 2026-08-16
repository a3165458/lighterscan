"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/components/i18n-provider";
import { SearchBox, SearchProvider } from "@/components/search";
import type { Lang } from "@/lib/i18n";
import { setThemeAction } from "@/app/actions/theme";
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
        void setThemeAction(theme);
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
    { href: "/leaderboard", label: t("nav.leaderboard") },
    { href: "/trackers", label: t("nav.trackers") },
    { href: "/tape", label: t("nav.tape") },
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
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted">
            <span>{t("footer.right")}</span>
          </div>
        </footer>
      </div>
    </SearchProvider>
  );
}
