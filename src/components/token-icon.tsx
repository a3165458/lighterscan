"use client";

import { useState } from "react";
import { baseSymbol, tokenIconCandidates } from "@/lib/format";

export function TokenIcon({
  symbol,
  size = 28,
}: {
  symbol: string;
  size?: number;
}) {
  const [step, setStep] = useState(0);
  const sources = tokenIconCandidates(symbol);
  const letter = baseSymbol(symbol).slice(0, 1).toUpperCase() || "?";

  if (step >= sources.length) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-hover text-[11px] font-semibold text-ink"
        style={{ width: size, height: size }}
      >
        {letter}
      </span>
    );
  }

  const src = sources[step];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-hover object-cover"
      onError={() => setStep((current) => current + 1)}
    />
  );
}
