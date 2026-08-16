"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { setLangAction } from "@/app/actions/lang";
import {
  htmlLang,
  LANG_COOKIE,
  t as lookup,
  type Lang,
  type MsgKey,
} from "@/lib/i18n";

type I18nValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (key: MsgKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function persistLang(next: Lang) {
  try {
    localStorage.setItem(LANG_COOKIE, next);
  } catch {
    /* ignore */
  }
  document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.lang = htmlLang(next);
  document.documentElement.dataset.lang = next;
}

export function I18nProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);


  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      persistLang(next);
      void setLangAction(next).then(() => router.refresh());
    },
    [router],
  );

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => lookup(lang, key, vars),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
