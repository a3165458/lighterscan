import { DEFAULT_THEME, type Theme } from "@/lib/theme";

/** ISR-safe: theme is applied by the boot script before paint. */
export async function getRequestTheme(): Promise<Theme> {
  return DEFAULT_THEME;
}
