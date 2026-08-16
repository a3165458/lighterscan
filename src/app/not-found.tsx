import Link from "next/link";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";

export default async function NotFound() {
  const lang = await getRequestLang();
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{t(lang, "notfound.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t(lang, "notfound.body")}</p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg"
      >
        {t(lang, "notfound.back")}
      </Link>
    </div>
  );
}
