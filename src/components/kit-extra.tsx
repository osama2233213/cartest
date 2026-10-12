import { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------- stepper */

type StepState = "done" | "current" | "upcoming" | "blocked";

function StepDot({ state, index }: { state: StepState; index: number }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        state === "done" && "bg-primary text-white",
        state === "current" && "bg-white text-primary ring-2 ring-inset ring-primary",
        state === "upcoming" && "bg-ink/[0.06] text-muted",
        state === "blocked" && "bg-danger/10 text-danger",
      )}
    >
      {state === "done" ? <Check aria-hidden className="h-4 w-4" /> : index + 1}
    </span>
  );
}

export function Stepper({
  steps,
  orientation = "horizontal",
  className,
}: {
  steps: { id: string; label: string; description?: string; state: StepState }[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  const cur = Math.max(0, steps.findIndex((s) => s.state === "current" || s.state === "blocked"));
  if (orientation === "vertical") {
    return (
      <ol className={cn("flex flex-col", className)}>
        {steps.map((st, i) => (
          <li key={st.id} aria-current={st.state === "current" ? "step" : undefined} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepDot state={st.state} index={i} />
              {i < steps.length - 1 && (
                <span className={cn("my-1 w-0.5 flex-1", st.state === "done" ? "bg-primary" : "bg-ink/10")} />
              )}
            </div>
            <div className="pb-6">
              <p className={cn("pt-1 font-semibold", st.state === "upcoming" ? "text-muted" : "text-ink")}>{st.label}</p>
              {st.description && <p className="text-sm text-muted">{st.description}</p>}
            </div>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className={className}>
      <p className="text-sm font-semibold text-ink md:hidden">
        Step {cur + 1} of {steps.length} · {steps[cur]?.label}
      </p>
      <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 md:hidden">
        <div
          className="h-full bg-primary transition-all duration-200"
          style={{ width: `${((cur + 1) / steps.length) * 100}%` }}
        />
      </div>
      <ol className="hidden items-start md:flex">
        {steps.map((st, i) => (
          <li
            key={st.id}
            aria-current={st.state === "current" ? "step" : undefined}
            className={cn("flex items-start", i < steps.length - 1 && "flex-1")}
          >
            <div className="flex flex-col items-center gap-1.5">
              <StepDot state={st.state} index={i} />
              <span
                className={cn("max-w-24 text-center text-xs font-medium", st.state === "upcoming" ? "text-muted" : "text-ink")}
              >
                {st.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={cn("mx-2 mt-4 h-0.5 flex-1", st.state === "done" ? "bg-primary" : "bg-ink/10")} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------- calendar */

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function Calendar({
  value,
  onChange,
  minDate,
  availableDates = [],
  disabledDate,
  className,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  minDate?: Date;
  availableDates?: Date[];
  disabledDate?: (d: Date) => boolean;
  className?: string;
}) {
  const start = value ?? minDate ?? new Date();
  const [month, setMonth] = useState(() => new Date(start.getFullYear(), start.getMonth(), 1));
  const [focus, setFocus] = useState(start);
  const grid = useRef<HTMLDivElement>(null);
  const lead = (month.getDay() + 6) % 7; // weeks start on Monday
  const days = Array.from(
    { length: 42 },
    (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - lead + i),
  );
  const isDisabled = (d: Date) => (minDate ? midnight(d) < midnight(minDate) : false) || !!disabledDate?.(d);
  const label = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const moveFocus = (d: Date) => {
    setFocus(d);
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    window.setTimeout(() => grid.current?.querySelector<HTMLElement>('[data-focus="true"]')?.focus(), 0);
  };

  return (
    <div className={cn("w-full max-w-sm rounded-2xl border border-ink/10 bg-white p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="rounded-xl p-2 text-muted hover:bg-ink/5"
        >
          <ChevronLeft aria-hidden className="h-5 w-5" />
        </button>
        <p aria-live="polite" className="font-semibold">
          {label}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="rounded-xl p-2 text-muted hover:bg-ink/5"
        >
          <ChevronRight aria-hidden className="h-5 w-5" />
        </button>
      </div>
      <div
        ref={grid}
        role="grid"
        aria-label={label}
        onKeyDown={(e) => {
          const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
          if (delta === undefined) return;
          e.preventDefault();
          moveFocus(new Date(focus.getFullYear(), focus.getMonth(), focus.getDate() + delta));
        }}
        className="grid grid-cols-7 gap-1 text-center"
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} role="columnheader" className="py-1 text-xs font-medium text-muted">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const sel = value ? sameDay(d, value) : false;
          const dis = isDisabled(d);
          const dot = availableDates.some((a) => sameDay(a, d));
          const foc = sameDay(d, focus);
          return (
            <button
              key={d.toISOString()}
              type="button"
              role="gridcell"
              disabled={dis}
              aria-selected={sel}
              aria-label={d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              data-focus={foc}
              tabIndex={foc ? 0 : -1}
              onClick={() => {
                setFocus(d);
                onChange(d);
              }}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-xl text-sm transition-colors",
                d.getMonth() !== month.getMonth() && "text-muted/60",
                sel ? "bg-primary font-semibold text-white" : "hover:bg-ink/5",
                dis && "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              {d.getDate()}
              {dot && !dis && (
                <span
                  aria-hidden
                  className={cn("absolute bottom-1 h-1 w-1 rounded-full", sel ? "bg-white" : "bg-primary")}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimeSlots({
  slots,
  value,
  onChange,
  label = "Available times",
  emptyText = "No times left on this day.",
}: {
  slots: { id: string; label: string; disabled?: boolean }[];
  value: string | null;
  onChange: (id: string) => void;
  label?: string;
  emptyText?: string;
}) {
  if (slots.length === 0) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {slots.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={s.id === value}
          disabled={s.disabled}
          onClick={() => onChange(s.id)}
          className={cn(
            "num h-10 rounded-full border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            s.id === value ? "border-primary bg-primary text-white" : "border-ink/15 bg-white hover:bg-ink/5",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- reason dialog */

import { Button, Modal } from "@/components/kit";

/** Confirm dialog that can ask for an optional reason (decline, cancel, mark done). */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  danger,
  reasons,
  onClose,
  onConfirm,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  reasons?: string[];
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState(reasons?.[0] ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={title}
      {...(description ? { description } : {})}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {reasons && (
        <div role="radiogroup" aria-label="Reason" className="space-y-2">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "flex w-full items-center rounded-xl border px-3 py-2.5 text-left text-sm font-medium",
                reason === r ? "border-primary bg-primary/10" : "border-ink/15 hover:border-ink/30",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}


/* ------------------------------------------------------------ progress ring */

export function ProgressRing({
  value,
  size = 72,
  label,
  children,
  className,
}: {
  value: number;
  size?: number;
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-ink/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className="stroke-primary transition-all duration-200"
        />
      </svg>
      <span className="num absolute text-sm font-semibold">{children ?? `${Math.round(v)}%`}</span>
    </div>
  );
}
