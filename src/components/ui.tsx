import Link from "next/link";

type Tone = "default" | "up" | "down" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  default: "",
  up: "text-up",
  down: "text-down",
  accent: "text-accent",
};

export function toneOf(value: number): Tone {
  return value > 0 ? "up" : value < 0 ? "down" : "default";
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className={`page-title ${eyebrow ? "mt-1" : ""}`}>{title}</h1>
        {lede ? <p className="page-lede">{lede}</p> : null}
      </div>
      {children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

export function Crumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="crumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 ? <span aria-hidden>/</span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Panel({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`panel ${className}`}>
      {children}
    </section>
  );
}

export function PanelHead({
  title,
  hint,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  hint?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel-head ${className}`}>
      {title !== undefined ? (
        <div className="min-w-0">
          <h2 className="panel-title">{title}</h2>
          {hint ? <p className="panel-sub">{hint}</p> : null}
        </div>
      ) : null}
      {children ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

export function StatStrip({
  cols,
  children,
  className = "",
}: {
  cols: 2 | 3 | 4 | 5;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`stat-strip stat-strip-${cols} ${className}`}>{children}</div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  size = "md",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  size?: "md" | "lg";
}) {
  return (
    <div className="stat">
      <span className="stat-label" title={label}>
        {label}
      </span>
      <div
        className={`stat-value ${size === "lg" ? "stat-value-lg" : ""} ${TONE_CLASS[tone]}`}
      >
        {value}
      </div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

export function Pager({
  page,
  pages,
  loading,
  hasNext,
  knownEnd,
  onOpen,
  labels,
}: {
  page: number;
  pages: number[];
  loading: boolean;
  hasNext: boolean;
  knownEnd: number;
  onOpen: (page: number) => void | Promise<void>;
  labels: { aria: string; page: string; prev: string; next: string };
}) {
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2"
      aria-label={labels.aria}
    >
      <p className="shrink-0 text-[11.5px] tabular text-faint">{labels.page}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void onOpen(page - 1)}
          disabled={loading || page <= 1}
          className="btn btn-xs"
        >
          {labels.prev}
        </button>
        {pages.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => void onOpen(value)}
            disabled={loading}
            aria-current={value === page ? "page" : undefined}
            className={`btn btn-xs w-7 justify-center px-0 tabular ${
              value === page ? "bg-hover font-medium text-ink" : "text-muted"
            }`}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void onOpen(page + 1)}
          disabled={loading || (!hasNext && page >= knownEnd)}
          className="btn btn-xs"
        >
          {labels.next}
        </button>
      </div>
    </nav>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="tag">{children}</span>;
}

export function SideBadge({ up, children }: { up: boolean; children: React.ReactNode }) {
  return <span className={`badge ${up ? "badge-up" : "badge-down"}`}>{children}</span>;
}
