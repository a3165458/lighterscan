import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, parseLang, type Lang } from "@/lib/i18n";

export async function getRequestLang(): Promise<Lang> {
  try {
    const jar = await cookies();
    return parseLang(jar.get(LANG_COOKIE)?.value) || DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}
