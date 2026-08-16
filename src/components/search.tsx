"use client";

import { Search as SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/i18n-provider";
import { isAccountIndex, isAddress, isLogHash } from "@/lib/format";
import type { MsgKey } from "@/lib/i18n";

type Hit = {
  kind: "address" | "account" | "market" | "log" | "unknown";
  href?: string;
  label: string;
  detail?: string;
};

type SearchCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SearchContext = createContext<SearchCtx | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <SearchContext.Provider value={{ open, setOpen }}>
      {children}
      <SearchDialog />
    </SearchContext.Provider>
  );
}

function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("SearchBox must be used within SearchProvider");
  return ctx;
}

export function SearchBox({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { setOpen } = useSearch();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`flex items-center gap-2 rounded-full border border-line bg-elev text-sm text-muted transition hover:border-line-strong hover:text-ink ${
        compact ? "h-9 px-3" : "h-10 w-full max-w-md px-4"
      }`}
      aria-haspopup="dialog"
    >
      <SearchIcon size={15} />
      <span className={compact ? "hidden sm:inline" : ""}>{t("search.button")}</span>
      <span className="ml-auto hidden items-center gap-1 sm:flex">
        <kbd className="kbd">⌘</kbd>
        <kbd className="kbd">K</kbd>
      </span>
    </button>
  );
}

function SearchDialog() {
  const router = useRouter();
  const { t } = useI18n();
  const { open, setOpen } = useSearch();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxId = useId();


  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => inputRef.current?.focus());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      if (!q.trim()) {
        setHits([]);
        return;
      }
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const data = (await res.json()) as { hits?: Hit[] };
        setHits(data.hits || []);
        setActive(0);
      } catch {
        setHits([]);
      }
    }, 120);
    return () => clearTimeout(handle);
  }, [q, open]);

  function close() {
    setOpen(false);
    setQ("");
    setHits([]);
  }

  function go(hit?: Hit) {
    if (hit?.href) {
      router.push(hit.href);
      close();
      return;
    }
    const query = q.trim();
    if (isLogHash(query)) router.push(`/logs/${query}`);
    else if (isAddress(query)) router.push(`/address/${query}`);
    else if (isAccountIndex(query)) router.push(`/account/${query}`);
    else if (query) router.push(`/markets/${encodeURIComponent(query.toUpperCase())}`);
    close();
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="panel w-full max-w-xl overflow-hidden shadow-[var(--shadow)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={boxId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <SearchIcon size={16} className="text-muted" />
          <input
            ref={inputRef}
            id={boxId}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(hits[active]);
              }
            }}
            placeholder={t("search.placeholder")}
            className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-faint"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-full px-2 py-1 text-xs text-muted hover:bg-hover hover:text-ink"
          >
            {t("search.close")}
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {hits.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">{t("search.empty")}</p>
          ) : (
            hits.map((hit, i) => (
              <button
                key={`${hit.kind}-${hit.label}`}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(hit)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left ${
                  i === active ? "bg-hover" : ""
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{hit.label}</div>
                  {hit.detail ? (
                    <div className="text-xs text-muted">{hit.detail}</div>
                  ) : null}
                </div>
                <span className="text-[11px] uppercase tracking-wider text-faint">
                  {t(`search.kind.${hit.kind}` as MsgKey)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
