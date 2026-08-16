export type Theme = "light" | "dark";

export const DEFAULT_THEME: Theme = "dark";
export const THEME_COOKIE = "ls-theme";

export function parseTheme(value: string | undefined | null): Theme {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "light" ? "light" : "dark";
}

export function themeClassName(theme: Theme): string {
  return theme === "light" ? "light" : "";
}
