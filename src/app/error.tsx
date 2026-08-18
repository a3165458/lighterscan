"use client";

import { useI18n } from "@/components/i18n-provider";

export default function ErrorView({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-sm py-20 text-center sm:py-28">
      <span className="eyebrow text-down">Error</span>
      <h1 className="page-title mt-1.5">{t("error.title")}</h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
        {t("error.fallback")}
      </p>
      <button type="button" onClick={reset} className="btn btn-accent mt-5">
        {t("error.retry")}
      </button>
    </div>
  );
}
