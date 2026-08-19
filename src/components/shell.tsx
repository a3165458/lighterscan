"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { GITHUB_REPO, RH_TRADE } from "@/lib/config";

function GitHubIcon({ size = 13 }: { size?: number }) {
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
      className="btn btn-icon text-muted hover:text-ink"
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
      {light ? <Moon size={14} /> : <Sun size={14} />}
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
      className="btn btn-xs px-2 text-muted hover:text-ink"
      onClick={() => setLang(next)}
    >
      {lang === "zh" ? t("lang.en") : t("lang.zh")}
    </button>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  // Grouped so related destinations read as clusters instead of one long pill row.
  const groups = [
    [
      { href: "/", label: t("nav.markets") },
      { href: "/stats", label: t("nav.stats") },
    ],
    [
      { href: "/tape", label: t("nav.tape") },
      { href: "/liquidations", label: t("nav.liquidations") },
      { href: "/positions", label: t("nav.positions") },
    ],
    [
      { href: "/trackers", label: t("nav.trackers") },
      { href: "/funding", label: t("nav.funding") },
    ],
  ];
  const flat = groups.flat();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <SearchProvider>
      <div className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
          <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-3 px-3 sm:px-4">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-accent text-[12px] font-bold text-bg">
                L
              </span>
              <span className="text-[14px] font-semibold tracking-tight">LighterScan</span>
              <span className="tag hidden lg:inline-flex">Robinhood Lighter</span>
            </Link>

            <nav className="ml-1 hidden items-center md:flex">
              {groups.map((group, index) => (
                <span key={index} className="flex items-center">
                  {index > 0 ? (
                    <span className="mx-2 h-3.5 w-px bg-line" aria-hidden />
                  ) : null}
                  {group.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex h-12 items-center px-2.5 text-[13px] transition-colors ${
                          active
                            ? "font-medium text-ink after:absolute after:inset-x-1.5 after:-bottom-px after:h-[2px] after:rounded-full after:bg-accent"
                            : "text-muted hover:text-ink"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </span>
              ))}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <SearchBox />
              <a
                href={RH_TRADE}
                target="_blank"
                rel="noreferrer"
                className="btn btn-accent hidden sm:inline-flex"
              >
                {t("nav.trade")}
              </a>
              <LangToggle />
              <ThemeToggle />
            </div>
          </div>

          <nav className="section-nav border-t border-line px-2 md:hidden">
            {flat.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-9 shrink-0 items-center px-2.5 text-[13px] ${
                    active
                      ? "font-medium text-ink after:absolute after:inset-x-1.5 after:bottom-0 after:h-[2px] after:rounded-full after:bg-accent"
                      : "text-muted"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <StatusTicker />

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 py-4 sm:px-4 sm:py-5">
          {children}
        </main>

        <footer className="mt-4 border-t border-line">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-3 py-4 text-[11.5px] text-faint sm:px-4">
            <span>{t("footer.right")}</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="/pool" className="hover:text-ink">
                {t("nav.pool")}
              </Link>
              <a href={RH_TRADE} target="_blank" rel="noreferrer" className="hover:text-ink">
                {t("footer.trade")}
              </a>
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
            </div>
          </div>
        </footer>
      </div>
    </SearchProvider>
  );
}
