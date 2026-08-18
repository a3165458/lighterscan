import Link from "next/link";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";

export default async function NotFound() {
  const lang = await getRequestLang();
  return (
    <div className="mx-auto max-w-sm py-20 text-center sm:py-28">
      <span className="eyebrow text-accent">404</span>
      <h1 className="page-title mt-1.5">{t(lang, "notfound.title")}</h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
        {t(lang, "notfound.body")}
      </p>
      <Link href="/" className="btn btn-accent mt-5">
        {t(lang, "notfound.back")}
      </Link>
    </div>
  );
}
