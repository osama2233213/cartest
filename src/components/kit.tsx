import {
  Link,
  type LinkProps,
} from "@tanstack/react-router";
import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Check,
  CircleAlert,
  Info,
  Loader2,
  X,
  XCircle,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ links */

/** Split "/cars?make=Honda#faq" into router props. External/anchor hrefs render a plain <a>. */
export function parseTo(to: string) {
  const [beforeHash = "", hash] = to.split("#");
  const [path = "", qs] = beforeHash.split("?");
  const search = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
  return { to: path || "/", search, hash: hash || undefined };
}

type AppLinkProps = Omit<LinkProps, "to" | "search" | "hash" | "children" | "className" | "activeProps"> & {
  to: string;
  className?: string | undefined;
  children?: ReactNode;
  onClick?: (() => void) | undefined;
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
  title?: string | undefined;
};

export function AppLink({ to, className, children, ...rest }: AppLinkProps) {
  if (to.startsWith("#") || to.startsWith("mailto:") || to.startsWith("http")) {
    return (
      <a href={to} className={className} {...(rest as object)}>
        {children}
      </a>
    );
  }
  const p = parseTo(to);
  return (
    <Link
      to={p.to as never}
      search={p.search as never}
      hash={p.hash as never}
      className={className}
      {...(rest as object)}
    >
      {children}
    </Link>
  );
}

/* ----------------------------------------------------------------- button */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white shadow-glow hover:bg-primary-600 active:bg-primary-700",
  secondary:
    "border border-ink/15 bg-white text-ink shadow-card hover:border-ink/25 hover:bg-surface",
  ghost: "bg-transparent text-ink hover:bg-ink/5",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-90",
  accent: "bg-cta text-cta-fg hover:brightness-110 active:brightness-95",
};
const SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-[52px] px-7 text-base",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  fullWidth = false,
  className?: string,
) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold",
    "transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98]",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100",
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    fullWidth && "w-full",
    className,
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn("h-5 w-5 animate-spin", className)} />;
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  fullWidth?: boolean | undefined;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean | undefined;
  className?: string | undefined;
};

export function Button({
  variant,
  size,
  fullWidth,
  leftIcon,
  rightIcon,
  loading,
  disabled,
  className,
  children,
  onClick,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, fullWidth, className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

type ButtonLinkProps = {
  to: string;
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  fullWidth?: boolean | undefined;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string | undefined;
  children?: ReactNode;
  onClick?: (() => void) | undefined;
};

export function ButtonLink({
  variant,
  size,
  fullWidth,
  leftIcon,
  rightIcon,
  className,
  children,
  to,
  onClick,
}: ButtonLinkProps) {
  return (
    <AppLink to={to} className={buttonClasses(variant, size, fullWidth, className)} onClick={onClick}>
      {leftIcon}
      {children}
      {rightIcon}
    </AppLink>
  );
}

/* ------------------------------------------------------------ surfaces */

const CARD_PAD = { none: "", sm: "p-4", md: "p-5 md:p-6" } as const;

export function Card({
  className,
  padding = "md",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padding?: keyof typeof CARD_PAD }) {
  return (
    <div
      className={cn("rounded-2xl border border-ink/[0.08] bg-white shadow-card", CARD_PAD[padding], className)}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  level = 3,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  level?: 1 | 2 | 3 | 4;
}) {
  const H = `h${level}` as "h3";
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <H className="font-sans text-base font-semibold leading-6 tracking-normal text-ink">{title}</H>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5 text-muted">{eyebrow}</p>}
        <h1 className="text-[26px] font-bold leading-8 md:text-[32px] md:leading-10">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold leading-7 md:text-2xl md:leading-8">{title}</h2>
          {description && <p className="mt-1 text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- badge */

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";
const BADGE: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: "bg-ink/[0.06] text-ink/80", dot: "bg-muted" },
  primary: { wrap: "bg-primary-50 text-primary-700", dot: "bg-primary" },
  success: { wrap: "bg-success/10 text-success", dot: "bg-success" },
  warning: { wrap: "bg-warning/10 text-warning", dot: "bg-warning" },
  danger: { wrap: "bg-danger/10 text-danger", dot: "bg-danger" },
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const t = BADGE[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold leading-5",
        t.wrap,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- alert */

const ALERT = {
  info: { wrap: "border-primary/15 bg-primary-50 text-ink", icon: Info, iconClass: "text-primary" },
  success: { wrap: "border-success/15 bg-success/[0.07] text-ink", icon: CheckCircle2, iconClass: "text-success" },
  warning: { wrap: "border-warning/20 bg-warning/[0.07] text-ink", icon: AlertTriangle, iconClass: "text-warning" },
  danger: { wrap: "border-danger/15 bg-danger/[0.06] text-ink", icon: XCircle, iconClass: "text-danger" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof ALERT;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const a = ALERT[tone];
  const Icon = a.icon;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-2xl border p-4", a.wrap, className)}
    >
      <Icon aria-hidden className={cn("mt-0.5 h-5 w-5 shrink-0", a.iconClass)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-sm text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- avatar */

const AVATAR = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" } as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | undefined;
  size?: keyof typeof AVATAR;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={cn("rounded-full object-cover", AVATAR[size], className)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700",
        AVATAR[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------ accordion */

export function Accordion({
  items,
  defaultOpenId,
  className,
}: {
  items: { id: string; title: ReactNode; content: ReactNode }[];
  defaultOpenId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState<string | undefined>(defaultOpenId);
  const uid = useId();
  return (
    <div className={cn("divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white", className)}>
      {items.map((it) => {
        const isOpen = it.id === open;
        const panel = `${uid}-${it.id}-panel`;
        const btn = `${uid}-${it.id}-btn`;
        return (
          <div key={it.id}>
            <h3>
              <button
                id={btn}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panel}
                onClick={() => setOpen(isOpen ? undefined : it.id)}
                className="flex min-h-[56px] w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold hover:bg-ink/5"
              >
                {it.title}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
            </h3>
            <div id={panel} role="region" aria-labelledby={btn} hidden={!isOpen} className="px-5 pb-5 text-muted">
              {it.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- fields */

export const fieldClasses = (invalid?: boolean) =>
  cn(
    "w-full rounded-xl border bg-white px-3.5 text-base text-ink placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150",
    "focus-visible:outline-none focus-visible:ring-4",
    "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-70",
    invalid
      ? "border-danger focus-visible:ring-danger/15"
      : "border-ink/15 hover:border-ink/30 focus-visible:border-primary focus-visible:ring-primary/15",
  );

export function Field({
  label,
  helper,
  error,
  required,
  className,
  children,
}: {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: (p: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const msg = `${id}-msg`;
  const describedBy = error || helper ? msg : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required && (
            <span aria-hidden className="ml-0.5 text-danger">
              *
            </span>
          )}
        </label>
      )}
      {children({ id, describedBy, invalid: !!error })}
      {error ? (
        <p id={msg} className="flex items-center gap-1 text-sm text-danger">
          <CircleAlert aria-hidden className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : helper ? (
        <p id={msg} className="text-sm text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  leftAdornment?: ReactNode;
  rightAdornment?: ReactNode;
  wrapperClassName?: string;
  size?: "sm" | "md";
};

export function TextInput({
  label,
  helper,
  error,
  required,
  leftAdornment,
  rightAdornment,
  wrapperClassName,
  className,
  size = "md",
  ...rest
}: TextInputProps) {
  return (
    <Field label={label} helper={helper} error={error} required={!!required} {...(wrapperClassName ? { className: wrapperClassName } : {})}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leftAdornment && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
              {leftAdornment}
            </span>
          )}
          <input
            id={id}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              fieldClasses(invalid),
              size === "sm" ? "h-10 text-sm" : "h-12",
              leftAdornment && "pl-9",
              rightAdornment && "pr-10",
              className,
            )}
            {...rest}
          />
          {rightAdornment && (
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-muted">
              {rightAdornment}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}

export function TextArea({
  label,
  helper,
  error,
  required,
  className,
  rows = 4,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; helper?: ReactNode; error?: ReactNode }) {
  return (
    <Field label={label} helper={helper} error={error} required={!!required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(fieldClasses(invalid), "py-3", className)}
          {...rest}
        />
      )}
    </Field>
  );
}

type NativeSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  options: { value: string; label: string }[];
  size?: "sm" | "md";
};

export function NativeSelect({
  label,
  helper,
  error,
  required,
  options,
  size = "md",
  className,
  ...rest
}: NativeSelectProps) {
  return (
    <Field label={label} helper={helper} error={error} required={!!required}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            id={id}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              fieldClasses(invalid),
              "appearance-none pr-10",
              size === "sm" ? "h-10 text-sm" : "h-12",
              className,
            )}
            {...rest}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
        </div>
      )}
    </Field>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-ink/30 bg-white checked:border-primary checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          {...rest}
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
        />
      </span>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-base text-ink">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </label>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <label htmlFor={`${id}-btn`} className="cursor-pointer">
        <span className="block text-base text-ink">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </label>
      <button
        id={`${id}-btn`}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-ink/20",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white transition-transform duration-150",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------- segmented + chips */

export function Segmented({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: string; label: ReactNode }[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-xl bg-surface p-1", className)}
    >
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors",
              sel ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink",
              "flex-1 px-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  selected,
  count,
  icon,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; count?: number; icon?: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors",
        selected
          ? "border-primary/30 bg-primary-50 text-primary-700"
          : "border-ink/10 bg-white text-ink/80 hover:border-ink/20 hover:bg-surface hover:text-ink",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "num -mr-1 rounded-full px-1.5 text-[11px] font-semibold leading-[18px]",
            selected ? "bg-primary text-white" : "bg-ink/[0.06] text-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* --------------------------------------------------------------- slider */

const pct = (v: number, min: number, max: number) =>
  Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  formatValue = String,
  marker,
  disabled,
  className,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
  formatValue?: (v: number) => string;
  marker?: { value: number; label: string } | undefined;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const p = pct(value, min, max);
  return (
    <div className={cn("pt-8", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <span
          aria-hidden
          className="num absolute -top-8 whitespace-nowrap rounded-lg bg-ink px-2 py-0.5 text-sm font-semibold text-white"
          style={{ left: `${p}%`, transform: `translateX(-${p}%)` }}
        >
          {formatValue(value)}
        </span>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={formatValue(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider h-6 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          style={{ "--p": `${p}%` } as React.CSSProperties}
        />
        {marker && (
          <span
            className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${pct(marker.value, min, max)}%` }}
          >
            <span className="h-6 w-0.5 bg-ink/60" />
          </span>
        )}
      </div>
      {marker && (
        <div className="relative mt-1 h-4">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-xs text-muted"
            style={{ left: `${pct(marker.value, min, max)}%` }}
          >
            {marker.label}
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- skeleton etc */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-ink/[0.06]", className)} />;
}

export function Breakdown({
  rows,
  total,
  className,
}: {
  rows: { label: string; hint?: string | undefined; value: string; tone?: "negative" | undefined }[];
  total?: { label: string; value: string } | undefined;
  className?: string;
}) {
  return (
    <dl className={cn("text-base", className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-start justify-between gap-4 py-2">
          <dt>
            <span className="text-muted">{r.label}</span>
            {r.hint && <span className="block text-sm text-muted">{r.hint}</span>}
          </dt>
          <dd className={cn("num font-medium", r.tone === "negative" && "text-muted")}>{r.value}</dd>
        </div>
      ))}
      {total && (
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-ink/10 pt-3">
          <dt className="font-semibold">{total.label}</dt>
          <dd className="num text-2xl font-bold">{total.value}</dd>
        </div>
      )}
    </dl>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  headingLevel?: 1 | 2 | 3;
  className?: string;
}) {
  const H = `h${headingLevel}` as "h2";
  return (
    <div className={cn("flex flex-col items-center px-4 py-10 text-center", className)}>
      {icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          {icon}
        </span>
      )}
      <H className="mt-4 font-sans text-xl font-bold leading-7 tracking-normal">{title}</H>
      {description && <p className="mt-1 max-w-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "Check your connection and try again.",
  onRetry,
  headingLevel = 2,
}: {
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  headingLevel?: 1 | 2 | 3;
}) {
  return (
    <EmptyState
      headingLevel={headingLevel}
      icon={<CircleAlert aria-hidden className="h-6 w-6" />}
      title={title}
      description={description}
      action={onRetry && <Button onClick={onRetry}>Try again</Button>}
    />
  );
}

/* --------------------------------------------------------------- overlay */

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  const max = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-raised sm:rounded-3xl",
          max,
        )}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3 md:p-6 md:pb-3">
          <div>
            <h2 id={titleId} className="text-xl font-bold leading-7">
              {title}
            </h2>
            {description && <p className="mt-1 text-muted">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 rounded-xl p-2 text-muted hover:bg-ink/5"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 md:px-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-ink/10 p-4 sm:flex-row sm:justify-end md:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Bottom sheet on mobile used for the mobile menu and filters. */
export function Sheet({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div aria-hidden className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85vh] w-full max-w-[calc(100vw)] flex-col rounded-t-3xl bg-white shadow-raised"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 rounded-xl p-2 text-muted hover:bg-ink/5"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-ink/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function usePointerOutside(
  refs: React.RefObject<HTMLElement | null>[],
  onOutside: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return;
    const h = (e: Event) => {
      const t = e.target as Node;
      if (!refs.some((r) => r.current?.contains(t))) onOutside();
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("touchstart", h);
    };
  }, [refs, onOutside, active]);
}

/** A small click-to-open popover. `trigger` receives props to spread + a toggle. */
export function Popover({
  trigger,
  children,
  align = "left",
  className,
}: {
  trigger: (p: { toggle: () => void; props: Record<string, unknown> }) => ReactNode;
  children: (p: { close: () => void }) => ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [ref], []);
  const close = useCallback(() => setOpen(false), []);
  usePointerOutside(refs, close, open);
  return (
    <div
      ref={ref}
      className="relative inline-block"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          ref.current?.querySelector<HTMLElement>("button")?.focus();
        }
      }}
    >
      {trigger({
        toggle: () => setOpen((o) => !o),
        props: { "aria-haspopup": "true", "aria-expanded": open, "aria-controls": id },
      })}
      {open && (
        <div
          id={id}
          className={cn(
            "absolute z-40 mt-2 rounded-2xl border border-ink/10 bg-white p-2 shadow-raised",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
}

export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onKeyDown={(e) => e.key === "Escape" && setShow(false)}
    >
      {cloneElement(children, { "aria-describedby": id } as object)}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-xs -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white",
          show ? "visible" : "invisible",
        )}
      >
        {content}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------- OTP + toasts */

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  disabled,
  label = "One-time code",
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const set = (v: string) => {
    onChange(v);
    if (v.length === length) onComplete?.(v);
  };
  const onDigit = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (!d) return;
    const next = digits.slice();
    next[i] = d.slice(-1);
    set(next.join("").slice(0, length));
    refs.current[Math.min(i + 1, length - 1)]?.focus();
  };
  const onKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = digits.slice();
      if (next[i]) next[i] = "";
      else if (i > 0) {
        next[i - 1] = "";
        refs.current[i - 1]?.focus();
      }
      onChange(next.join("").trimEnd());
    } else if (e.key === "ArrowLeft") refs.current[Math.max(i - 1, 0)]?.focus();
    else if (e.key === "ArrowRight") refs.current[Math.min(i + 1, length - 1)]?.focus();
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!d) return;
    e.preventDefault();
    set(d);
    refs.current[Math.min(d.length, length - 1)]?.focus();
  };
  return (
    <div
      key={error ? "err" : "ok"}
      role="group"
      aria-label={label}
      className={cn("flex gap-2 sm:gap-3", error && "shake")}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={error || undefined}
          onChange={(e) => onDigit(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "num h-14 w-full min-w-0 rounded-xl border bg-white text-center text-2xl font-semibold text-ink disabled:opacity-50",
            error ? "border-danger" : "border-ink/15",
          )}
        />
      ))}
    </div>
  );
}

type ToastItem = {
  id: number;
  tone?: "info" | "success" | "warning" | "danger";
  title: string;
  description?: string;
};
const ToastCtx = createContext<((t: Omit<ToastItem, "id">) => void) | null>(null);
const TOAST_ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };
const TOAST_COLOR = { info: "text-primary", success: "text-success", warning: "text-warning", danger: "text-danger" };
let toastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((s) => s.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = toastId++;
      setItems((s) => [...s, { ...t, id }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-auto md:right-4 md:top-4 md:items-end"
      >
        {items.map((t) => {
          const tone = t.tone ?? "info";
          const Icon = TOAST_ICON[tone];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-raised"
            >
              <Icon aria-hidden className={cn("mt-0.5 h-5 w-5 shrink-0", TOAST_COLOR[tone])} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.title}</p>
                {t.description && <p className="text-sm text-muted">{t.description}</p>}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="-m-1 rounded-lg p-1 text-muted hover:bg-ink/5"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast must be used inside ToastProvider");
  return c;
}

/** Counts down from `seconds`; `restart` starts over. */
export function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) return;
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [remaining]);
  return { remaining, restart: useCallback(() => setRemaining(seconds), [seconds]) };
}

export { UploadCloud };
