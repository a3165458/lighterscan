"use server";

import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

export async function setThemeAction(next: Theme) {
  const theme = parseTheme(next);
  const jar = await cookies();
  jar.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return theme;
}
