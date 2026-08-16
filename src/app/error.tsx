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
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("error.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("error.fallback")}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg"
      >
        {t("error.retry")}
      </button>
    </div>
  );
}
