import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { Shell } from "@/components/shell";
import { htmlLang } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { getRequestTheme } from "@/lib/theme-server";
import { themeClassName } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LighterScan — Robinhood Lighter Explorer",
    template: "%s · LighterScan",
  },
  description:
    "Explore Robinhood Lighter markets, accounts, addresses, leaderboards, and live trading flow.",
};

const boot = `
try {
  var storedLang = localStorage.getItem('ls-lang');
  var cookieLang = (document.cookie.match(/(?:^|; )ls-lang=([^;]*)/) || [])[1];
  var lang = storedLang || cookieLang || 'zh';
  if (lang !== 'en' && lang !== 'zh') lang = 'zh';
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.lang = lang;
  var storedTheme = localStorage.getItem('ls-theme');
  var cookieTheme = (document.cookie.match(/(?:^|; )ls-theme=([^;]*)/) || [])[1];
  var theme = storedTheme || cookieTheme || 'dark';
  document.documentElement.classList.toggle('light', theme === 'light');
} catch (e) {}
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [lang, theme] = await Promise.all([getRequestLang(), getRequestTheme()]);
  const themeClass = themeClassName(theme);
  return (
    <html
      lang={htmlLang(lang)}
      data-lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${themeClass ? ` ${themeClass}` : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body className="min-h-full">
        <I18nProvider initialLang={lang}>
          <Shell>{children}</Shell>
        </I18nProvider>
      </body>
    </html>
  );
}
