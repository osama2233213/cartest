import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Card, Modal, Popover, Skeleton, TextArea, useToast } from "@/components/kit";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------- url params */

/** Route `validateSearch` for admin pages: keep whatever is in the URL. */
export const anySearch = (s: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));

/** Filters, sorting and paging live in the URL so the back button and shared links work. */
export function useUrlParams() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const get = useCallback((k: string) => (search[k] === undefined ? null : String(search[k])), [search]);
  const set = useCallback(
    (patch: Record<string, string | null>) => {
      navigate({
        to: ".",
        replace: true,
        search: ((prev: Record<string, unknown>) => {
          const next: Record<string, unknown> = { ...prev };
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === "") delete next[k];
            else next[k] = v;
          }
          if (!("page" in patch)) delete next["page"];
          return next;
        }) as never,
      });
    },
    [navigate],
  );
  const clear = useCallback(() => navigate({ to: ".", replace: true, search: {} as never }), [navigate]);
  return { params: { get }, set, clear };
}

/** Runs an action with a busy flag, a toast on success and the message on failure. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const run = async <T,>(key: string, fn: () => Promise<T> | T, success?: string): Promise<boolean> => {
    setBusy(key);
    setError(undefined);
    try {
      await fn();
      if (success) toast({ tone: "success", title: success });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(undefined);
    }
  };
  return { busy, error, run, clearError: () => setError(undefined) };
}

/* ---------------------------------------------------------------- layout */

export const AdminPage = ({ children, narrow }: { children: ReactNode; narrow?: boolean }) => (
  <div className={cn("mx-auto", narrow ? "max-w-5xl" : "max-w-7xl")}>{children}</div>
);

export function AdminHeader({ title, description, action, eyebrow }: { title: ReactNode; description?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5 text-muted">{eyebrow}</p>}
        <h1 className="text-[26px] font-bold leading-8 md:text-[32px] md:leading-10">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function KpiCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card padding="sm" className="h-full">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="num mt-1 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function DetailSection({ id, title, description, count, action, children }: { id?: string; title: ReactNode; description?: ReactNode; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-sans text-lg font-semibold leading-6 tracking-normal">
            {title}
            {count !== undefined && <span className="num rounded-full bg-ink/[0.07] px-2 text-xs leading-5 text-ink/70">{count}</span>}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function SummaryFacts({ facts }: { facts: { label: string; value: ReactNode; strong?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-x-10">
      {facts.map((f) => (
        <div key={f.label}>
          <dt className="text-xs text-muted">{f.label}</dt>
          <dd className={cn("num text-[15px]", f.strong ? "font-bold" : "font-semibold")}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FilterBar({ children, label = "Filters" }: { children: ReactNode; label?: string }) {
  return (
    <div role="group" aria-label={label} className="mb-4 flex flex-wrap items-end gap-3">
      {children}
    </div>
  );
}

export function FilterTabs({ idPrefix, value, onChange, items, className }: { idPrefix: string; value: string; onChange: (v: string) => void; items: { id: string; label: string; count?: number | undefined }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-ink/10", className)}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            id={`${idPrefix}-${it.id}`}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(it.id)}
            className={cn("-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold", on ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {it.label}
            {it.count !== undefined && <span className={cn("num rounded-full px-2 text-xs leading-5", on ? "bg-primary text-white" : "bg-ink/[0.07] text-ink/70")}>{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ChartCard({ title, takeaway, className, table, children }: { title: string; takeaway?: ReactNode; className?: string; table?: { caption: string; head: string[]; rows: (string | number)[][] }; children: ReactNode }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <h2 className="font-sans text-base font-semibold tracking-normal">{title}</h2>
      {takeaway && <p className="mt-0.5 text-sm text-muted">{takeaway}</p>}
      <div className="mt-3 h-64 text-primary" aria-hidden={table ? true : undefined}>
        {children}
      </div>
      {table && (
        <table className="sr-only">
          <caption>{table.caption}</caption>
          <thead>
            <tr>
              {table.head.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- menus */

export function ActionMenu({ trigger, triggerLabel, items, align = "right" }: { trigger: ReactNode; triggerLabel: string; items: { label: string; danger?: boolean; icon?: ReactNode; onSelect: () => void }[]; align?: "left" | "right" }) {
  return (
    <Popover
      align={align}
      className="w-56 p-1.5"
      trigger={({ props, toggle }) => (
        <button type="button" onClick={toggle} {...props} aria-label={triggerLabel} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {trigger}
        </button>
      )}
    >
      {({ close }) => (
        <ul role="menu">
          {items.map((it) => (
            <li key={it.label} role="none">
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  close();
                  it.onSelect();
                }}
                className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-ink/5", it.danger && "text-danger")}
              >
                {it.icon}
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  tone = "primary",
  busy,
  error,
  onClose,
  onConfirm,
  children,
}: {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean | undefined;
  error?: string | undefined;
  onClose: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={body}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={!!busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {children}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

/** A modal with a note box. Used for "tell them why" prompts. */
export function NoteModal({
  open,
  title,
  description,
  label,
  helper,
  minLength = 10,
  confirmLabel,
  tone = "primary",
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  helper?: string;
  minLength?: number;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean | undefined;
  error?: string | undefined;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={!!busy} disabled={text.trim().length < minLength} onClick={() => onSubmit(text)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextArea label={label} helper={helper ?? `At least ${minLength} characters.`} value={text} onChange={(e) => setText(e.target.value)} rows={4} />
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- table */

export type Column<T> = { key: string; header: ReactNode; render: (row: T) => ReactNode; sortable?: boolean; align?: "right" };

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  loading,
  sortKey,
  sortDir,
  onSort,
  emptyState,
  page,
  pageSize,
  total,
  onPageChange,
  selectable,
  selectedIds = [],
  onSelectionChange,
  mobileCard,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  getRowId: (r: T) => string;
  loading?: boolean | undefined;
  sortKey?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  onSort?: ((key: string) => void) | undefined;
  emptyState?: ReactNode;
  page?: number | undefined;
  pageSize?: number | undefined;
  total?: number | undefined;
  onPageChange?: ((p: number) => void) | undefined;
  selectable?: boolean | undefined;
  selectedIds?: string[] | undefined;
  onSelectionChange?: ((ids: string[]) => void) | undefined;
  mobileCard?: ((r: T) => ReactNode) | undefined;
}) {
  const headId = useId();
  const all = rows.length > 0 && rows.every((r) => selectedIds.includes(getRowId(r)));
  const pages = pageSize && total ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const from = page && pageSize && total ? (page - 1) * pageSize + 1 : 1;
  const to = page && pageSize && total ? Math.min(total, page * pageSize) : rows.length;
  return (
    <div className="rounded-2xl border border-ink/10 bg-white">
      <div className={cn("overflow-x-auto", mobileCard && "hidden md:block")}>
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm" aria-labelledby={headId}>
          <caption id={headId} className="sr-only">
            {caption}
          </caption>
          <thead className="bg-surface">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={all}
                    onChange={() => onSelectionChange?.(all ? [] : rows.map(getRowId))}
                    className="h-4 w-4 accent-[rgb(var(--c-primary))]"
                  />
                </th>
              )}
              {columns.map((c) => {
                const active = sortKey === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined} className={cn("whitespace-nowrap px-4 py-3 font-semibold text-muted", c.align === "right" && "text-right")}>
                    {c.sortable && onSort ? (
                      <button type="button" onClick={() => onSort(c.key)} className="inline-flex items-center gap-1 rounded hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        {c.header}
                        {active ? sortDir === "asc" ? <ChevronUp aria-hidden className="h-4 w-4" /> : <ChevronDown aria-hidden className="h-4 w-4" /> : <ChevronDown aria-hidden className="h-4 w-4 opacity-30" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-t border-ink/10">
                    <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-3">
                      <Skeleton className="h-8" />
                    </td>
                  </tr>
                ))
              : rows.map((r) => {
                  const id = getRowId(r);
                  const sel = selectedIds.includes(id);
                  return (
                    <tr key={id} className={cn("border-t border-ink/10 align-middle hover:bg-surface/60", sel && "bg-primary/5")}>
                      {selectable && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label="Select row"
                            checked={sel}
                            onChange={() => onSelectionChange?.(sel ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])}
                            className="h-4 w-4 accent-[rgb(var(--c-primary))]"
                          />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key} className={cn("px-4 py-3", c.align === "right" && "num text-right")}>
                          {c.render(r)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {mobileCard && (
        <ul className="divide-y divide-ink/10 md:hidden">
          {rows.map((r) => (
            <li key={getRowId(r)} className="p-4">
              {mobileCard(r)}
            </li>
          ))}
        </ul>
      )}
      {!loading && rows.length === 0 && emptyState}
      {!loading && page && pageSize && total !== undefined && total > pageSize && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-3 text-sm">
          <p className="num text-muted">
            {from}–{to} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)} leftIcon={<ChevronLeft aria-hidden className="h-4 w-4" />}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPageChange?.(page + 1)} rightIcon={<ChevronRight aria-hidden className="h-4 w-4" />}>
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

/** Sorts, then slices one page. */
export function pageOf<T>(rows: T[], page: number, size: number) {
  return rows.slice((page - 1) * size, page * size);
}

export function useSortParam(defaultSort: string, keys: string[]) {
  const { params, set } = useUrlParams();
  const raw = params.get("sort") ?? defaultSort;
  const key = keys.find((k) => raw.replace(/^-/, "") === k) ?? defaultSort.replace(/^-/, "");
  const dir: "asc" | "desc" = raw.startsWith("-") ? "desc" : "asc";
  return { sortKey: key, sortDir: dir, onSort: (k: string) => set({ sort: k === key && dir === "desc" ? k : `-${k}` }) };
}

export const useFocusFirst = () => useRef<HTMLDivElement>(null);

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
