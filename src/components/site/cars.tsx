import { useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, Car as CarIcon, Heart } from "lucide-react";
import { AppLink, Modal, Skeleton } from "@/components/kit";
import { dealTerms } from "@/lib/finance";
import { listedAgo, miles, money, moneyC } from "@/lib/format";
import { photoSrcSet, sizedPhoto } from "@/lib/images";
import type { PublicVehicle } from "@/lib/vehicles.functions";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------- helpers */

export const BODY_TYPES = ["sedan", "suv", "truck", "hatchback", "coupe"] as const;

export const bodyLabel = (b: string | null | undefined) =>
  !b ? "" : b.toLowerCase() === "suv" ? "SUV" : b[0]!.toUpperCase() + b.slice(1).toLowerCase();

export const carTitle = (v: PublicVehicle) => `${v.year} ${v.make} ${v.model}`;
export const carFullTitle = (v: PublicVehicle) => `${carTitle(v)} ${v.trim ?? ""}`.trim();

/** Estimated monthly payment (dollars) at the seller's smallest down payment and longest term. */
export function carEstimate(v: PublicVehicle) {
  const t = dealTerms({
    priceCents: v.price_cents,
    downPct: Number(v.min_down_pct),
    apr: Number(v.apr),
    termMonths: Math.max(...v.allowed_terms),
  });
  return { minDown: t.down / 100, monthly: t.monthly / 100 };
}

/** Sticky offset for the filter sidebar and the car-detail price panel. */
export const STICKY_TOP = "top-24";
export const CAR_GRID = "grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))]";

/* -------------------------------------------------------------- image */

const ASPECT = { "4/3": "aspect-[4/3]", "16/10": "aspect-[16/10]", "16/9": "aspect-video", square: "aspect-square" } as const;

export function CarImage({
  src,
  alt,
  make,
  model,
  className,
  aspect = "4/3",
  wide = false,
  sizes,
  priority = false,
}: {
  src?: string | undefined;
  alt: string;
  make?: string | undefined;
  model?: string | undefined;
  className?: string;
  aspect?: keyof typeof ASPECT;
  /** Big photos (the car page). Cards and thumbnails use the small sizes. */
  wide?: boolean;
  sizes?: string;
  /** Load right away (the first cards on screen). */
  priority?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">(src ? "loading" : "error");
  const [last, setLast] = useState(src);
  if (src !== last) {
    setLast(src);
    setState(src ? "loading" : "error");
  }

  if (state === "error") {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-50 to-surface text-primary/60",
          ASPECT[aspect],
          className,
        )}
      >
        <CarIcon aria-hidden className="h-8 w-8" />
        {(make || model) && (
          <span className="px-2 text-center text-sm font-medium text-muted">{[make, model].filter(Boolean).join(" ")}</span>
        )}
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-surface", ASPECT[aspect], className)}>
      {state === "loading" && <div aria-hidden className="absolute inset-0 animate-pulse bg-ink/[0.06]" />}
      <img
        src={src ? sizedPhoto(src, wide ? 1200 : 640) : src}
        srcSet={src ? photoSrcSet(src, wide ? [800, 1200, 1600] : [320, 480, 640, 960]) : undefined}
        sizes={sizes ?? (wide ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 280px, (min-width: 640px) 45vw, 100vw")}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : {})}
        onLoad={() => setState("ok")}
        onError={() => setState("error")}
        className={cn("h-full w-full object-cover transition-opacity duration-200", state === "ok" ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}

export function VerifiedSeller({ label = "Verified seller" }: { label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary-50 px-2.5 py-0.5 text-sm font-medium text-primary-700">
      <BadgeCheck aria-hidden className="h-4 w-4" />
      {label}
    </span>
  );
}

/* --------------------------------------------------------------- card */

export function CarCard({
  vehicle: v,
  saved,
  onToggleSave,
  priority = false,
}: {
  vehicle: PublicVehicle;
  priority?: boolean;
  saved?: boolean;
  onToggleSave?: (() => void) | undefined;
}) {
  const { minDown, monthly } = carEstimate(v);
  const title = carTitle(v);
  const full = carFullTitle(v);
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ink/[0.08] bg-white shadow-card transition-shadow duration-200 hover:border-ink/15 hover:shadow-raised">
      <AppLink
        to={`/cars/${v.id}`}
        className="flex flex-1 flex-col rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="relative overflow-hidden">
          <CarImage
            src={v.photos[0]}
            alt={`${full} photo`}
            make={v.make}
            model={v.model}
            aspect="16/10"
            priority={priority}
            className="rounded-none transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {v.seller_verified && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-card">
              <BadgeCheck aria-hidden className="h-3.5 w-3.5 text-primary" />
              Verified seller
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
          <h3 className="truncate text-[15px] font-semibold leading-5">{title}</h3>
          <p className="num mt-0.5 truncate text-[13px] text-muted">
            {[v.trim, miles(v.mileage), `${v.city}, ${v.state}`].filter(Boolean).join(" · ")}
          </p>
          <div aria-hidden className="min-h-3 flex-1" />
          <div className="flex items-baseline justify-between gap-3">
            <p className="num font-display text-xl font-bold leading-7 tracking-tight">
              ≈ {money(Math.round(monthly))}
              <span className="font-sans text-[13px] font-medium tracking-normal text-muted">/mo</span>
            </p>
            <p className="num text-[15px] font-semibold">{moneyC(v.price_cents)}</p>
          </div>
          <p className="num mt-0.5 truncate text-xs text-muted">
            from {money(minDown)} down
            {v.created_at && <> · listed {listedAgo(v.created_at)}</>}
          </p>
        </div>
      </AppLink>
      {onToggleSave && (
        <button
          type="button"
          aria-pressed={!!saved}
          aria-label={`${saved ? "Remove" : "Save"} ${full}`}
          onClick={onToggleSave}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-card transition-transform hover:scale-105 hover:bg-white"
        >
          <Heart aria-hidden className={cn("h-4 w-4", saved ? "fill-primary text-primary" : "text-ink")} />
        </button>
      )}
    </div>
  );
}

export function CarCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-ink/[0.08] bg-white shadow-card">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex items-end justify-between border-t border-ink/[0.06] pt-3">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- lightbox */

const NAV_BTN =
  "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-raised transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function Lightbox({
  open,
  onClose,
  photos,
  index,
  onIndex,
  alt,
}: {
  open: boolean;
  onClose: () => void;
  photos: string[];
  index: number;
  onIndex: (i: number) => void;
  alt: string;
}) {
  const go = (d: number) => onIndex((index + d + photos.length) % photos.length);
  return (
    <Modal open={open} onClose={onClose} title="Photos" size="lg">
      <div
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        <div className="relative">
          <CarImage src={photos[index] || undefined} alt={`${alt}, photo ${index + 1}`} aspect="16/9" wide priority={index === 0} />
          {photos.length > 1 && (
            <>
              <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className={cn(NAV_BTN, "left-3")}>
                <ChevronLeft aria-hidden className="h-5 w-5" />
              </button>
              <button type="button" aria-label="Next photo" onClick={() => go(1)} className={cn(NAV_BTN, "right-3")}>
                <ChevronRight aria-hidden className="h-5 w-5" />
              </button>
              <span
                aria-live="polite"
                className="num absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/75 px-3 py-1 text-sm font-semibold text-white"
              >
                {index + 1} / {photos.length}
              </span>
            </>
          )}
        </div>
        {photos.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                onClick={() => onIndex(i)}
                className={cn(
                  "w-20 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 transition-opacity focus-visible:outline-none",
                  i === index ? "ring-primary" : "opacity-70 ring-transparent hover:opacity-100",
                )}
              >
                <CarImage src={p || undefined} alt="" className="rounded-none" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
