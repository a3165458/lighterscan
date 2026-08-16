"use server";

import { LANG_COOKIE, parseLang, type Lang } from "@/lib/i18n";
import { cookies } from "next/headers";

export async function setLangAction(next: Lang) {
  const lang = parseLang(next);
  const jar = await cookies();
  jar.set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return lang;
}
