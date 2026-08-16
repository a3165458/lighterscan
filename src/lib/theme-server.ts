import { cookies } from "next/headers";
import { DEFAULT_THEME, parseTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

export async function getRequestTheme(): Promise<Theme> {
  try {
    const jar = await cookies();
    return parseTheme(jar.get(THEME_COOKIE)?.value) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}
