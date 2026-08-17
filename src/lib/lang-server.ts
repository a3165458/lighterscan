import { DEFAULT_LANG, type Lang } from "@/lib/i18n";

/** ISR-safe: language is applied on the client so HTML can stay on the CDN. */
export async function getRequestLang(): Promise<Lang> {
  return DEFAULT_LANG;
}
