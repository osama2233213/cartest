import { Link, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { isDemoCarId, loadVehicle } from "@/lib/vehicle-loader";
import { format } from "date-fns/format";
import { useId, useMemo, useState, type ReactNode } from "react";
import {
  Armchair,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Gauge,
  Heart,
  Images,
  KeyRound,
  Lock,
  MapPin,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import {
  Alert,
  AppLink,
  Avatar,
  Breakdown,
  EmptyState,
  Button,
  Card,
  CardHeader,
  Modal,
  Segmented,
  Slider,
  TextArea,
  useToast,
} from "@/components/kit";
import { Calendar, TimeSlots, sameDay } from "@/components/kit-extra";
import { openSlots, requestDrive, useAvailability, useDrives } from "@/lib/drives";
import { SiteLayout } from "@/components/site/SiteChrome";
import { CarCard, CarImage, Lightbox, STICKY_TOP, VerifiedSeller, bodyLabel, carFullTitle, carTitle } from "@/components/site/cars";
import { sellerFullName, useDemoStore } from "@/lib/demo-store";
import { dealTerms, fmtUsd, marketPosition } from "@/lib/finance";
import { listedAgo, miles, money, percent, titleCase } from "@/lib/format";
import { liveSettings } from "@/lib/live-settings";
import { useSaved } from "@/lib/saved";
import { useCurrentUser, type SessionUser } from "@/lib/session";
import { listPublicVehicles, type PublicVehicle } from "@/lib/vehicles.functions";
import { cn } from "@/lib/utils";

const listQuery = queryOptions({ queryKey: ["public-vehicles"], queryFn: () => listPublicVehicles() });

export const Route = createFileRoute("/cars/$id/")({
  // Demo cars only exist in this browser, so they render on the client; the server has nothing to show for them.
  ssr: ({ params }) => params.status !== "success" || !isDemoCarId(params.value.id),
  loader: loadVehicle,
  head: ({ loaderData: v }) => {
    const title = v ? `${v.year} ${v.make} ${v.model} — ${fmtUsd(v.price_cents)} on OwnerFi` : "Car — OwnerFi";
    const desc = v ? `Seller-financed ${v.year} ${v.make} ${v.model} in ${v.city}, ${v.state}. ${v.apr}% APR, ${v.min_down_pct}% down.` : "Seller-financed car on OwnerFi.";
    const img = v?.photos[0];
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(img?.startsWith("https://") ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
    };
  },
  component: CarPage,
  errorComponent: () => <p className="p-10 text-center">Couldn't load this car.</p>,
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <p className="font-semibold text-lg text-ink">This car isn't available anymore.</p>
      <Link to="/cars" className="mt-2 inline-block text-primary underline">Browse other cars</Link>
    </div>
  ),
});

/* ------------------------------------------------------------------ gating */

type Gate = {
  needsLogin: boolean;
  hideActions: boolean;
  ask: boolean;
  testDrive: boolean;
  offer: boolean;
  message?: string;
  fix?: { label: string; to: string };
};

const allOf = (v: boolean) => ({ ask: v, testDrive: v, offer: v });

function gateFor(user: SessionUser | null, v: PublicVehicle): Gate {
  const base = { needsLogin: false, hideActions: false };
  if (v.status === "reserved") return { ...base, ...allOf(false), message: "A buyer is already in talks on this car." };
  if (!user) return { ...base, ...allOf(true), needsLogin: true, message: "Log in or sign up to contact the seller." };
  if (user.role === "admin") return { ...base, ...allOf(false), hideActions: true, message: "Viewing as admin." };
  if (user.role === "seller") {
    return {
      ...base,
      ...allOf(false),
      hideActions: true,
      message: "Switch to a buyer account to contact sellers.",
    };
  }
  const ver = user.verification;
  if (!user.emailVerified) {
    return { ...base, ...allOf(false), message: "Verify your email to message sellers.", fix: { label: "Verify email", to: "/buyer" } };
  }
  if (ver.phone !== "verified") {
    return {
      ...base,
      ask: true,
      testDrive: false,
      offer: false,
      message: "Verify your phone to book a test drive. The seller texts you the details.",
      fix: { label: "Verify phone", to: "/buyer/account/verification" },
    };
  }
  if (ver.identity !== "verified") {
    return {
      ...base,
      ask: true,
      testDrive: false,
      offer: false,
      message: "Verify your identity to book a test drive. It keeps sellers safe.",
      fix: { label: "Verify now", to: "/buyer/verification" },
    };
  }
  if (ver.bank !== "verified" || ver.credit !== "verified") {
    return {
      ...base,
      ask: true,
      testDrive: true,
      offer: false,
      message: "Connect your bank and agree to a soft credit check to make an offer.",
      fix: { label: "Continue verification", to: "/buyer/verification" },
    };
  }
  return { ...base, ...allOf(true) };
}

function ActionBlock({
  gate,
  actions,
  onLogin,
  sticky,
}: {
  gate: Gate;
  actions: { ask: () => void; bookTestDrive: () => void; makeOffer: () => void };
  onLogin: () => void;
  sticky?: boolean;
}) {
  const wire = (enabled: boolean, run: () => void) => ({
    "aria-disabled": !enabled || undefined,
    onClick: () => {
      if (!enabled) return;
      if (gate.needsLogin) onLogin();
      else run();
    },
  });
  const ask = wire(gate.ask, actions.ask);
  const drive = wire(gate.testDrive, actions.bookTestDrive);
  const offer = wire(gate.offer, actions.makeOffer);
  const note = gate.message && (
    <p className={cn("flex items-start gap-2 text-sm text-muted", !sticky && "rounded-xl bg-surface px-3 py-2.5")}>
      <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {gate.message}{" "}
        {gate.fix && (
          <AppLink to={gate.fix.to} className="font-semibold text-primary hover:underline">
            {gate.fix.label}
          </AppLink>
        )}
      </span>
    </p>
  );

  if (sticky) {
    return (
      <div className="space-y-2">
        {note}
        {!gate.hideActions && (
          <div className="grid grid-cols-[1fr_1fr_1.3fr] gap-2">
            <Button variant="secondary" className="px-2 text-sm" {...ask}>
              Ask seller
            </Button>
            <Button variant="secondary" className="px-2 text-sm" {...drive}>
              Test drive
            </Button>
            <Button className="px-2 text-sm" {...offer}>
              Make an offer
            </Button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {!gate.hideActions && (
        <>
          <Button size="lg" fullWidth {...offer}>
            Make an offer
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="px-3" {...ask}>
              Ask a question
            </Button>
            <Button variant="secondary" className="px-3" {...drive}>
              Book test drive
            </Button>
          </div>
        </>
      )}
      {note}
    </div>
  );
}

/* ----------------------------------------------------------------- header */

function CarHeader({ vehicle: v, title }: { vehicle: PublicVehicle; title: string }) {
  const saved = useSaved();
  const isSaved = saved.isSaved(v.id);
  const checked = (v.history_summary?.title ?? "clean") === "clean";
  const meta = [
    { icon: Gauge, text: miles(v.mileage) },
    { icon: MapPin, text: `${v.city}, ${v.state}` },
    { icon: CalendarDays, text: `Listed ${listedAgo(v.created_at)}` },
  ];
  const pos =
    v.market_low_cents && v.market_high_cents
      ? marketPosition(v.price_cents, { low: v.market_low_cents, high: v.market_high_cents })
      : null;
  return (
    <div className="mb-5">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex min-w-0 items-center gap-1 text-sm text-muted">
          <li>
            <AppLink to="/cars" className="font-medium hover:text-ink hover:underline">
              Cars
            </AppLink>
          </li>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
          <li>
            <AppLink to={`/cars?make=${encodeURIComponent(v.make)}`} className="font-medium hover:text-ink hover:underline">
              {v.make}
            </AppLink>
          </li>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
          <li aria-current="page" className="truncate text-ink">
            {v.model}
          </li>
        </ol>
      </nav>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-9 md:text-[36px] md:leading-[44px]">{title}</h1>
          <ul className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[15px] text-muted">
            {meta.map(({ icon: Icon, text }) => (
              <li key={text} className="num inline-flex items-center gap-1.5">
                <Icon aria-hidden className="h-4 w-4" />
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {v.seller_verified && <VerifiedSeller />}
            {checked && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success/10 px-2.5 py-0.5 text-sm font-medium text-success">
                <ShieldCheck aria-hidden className="h-4 w-4" />
                Title and theft checked
              </span>
            )}
            {pos && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-medium",
                  pos === "below" ? "bg-success/10 text-success" : pos === "fair" ? "bg-primary-50 text-primary-700" : "bg-warning/10 text-warning",
                )}
              >
                {pos === "below" ? "Below market price" : pos === "fair" ? "Fair market price" : "Above market price"}
              </span>
            )}
          </div>
        </div>
        {saved.canSave && (
          <Button
            variant="secondary"
            aria-pressed={isSaved}
            onClick={() => saved.toggle(v.id)}
            leftIcon={<Heart aria-hidden className={cn("h-4 w-4", isSaved && "fill-primary text-primary")} />}
            className="self-start md:self-auto"
          >
            {isSaved ? "Saved" : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- gallery */

function Gallery({ vehicle: v, title }: { vehicle: PublicVehicle; title: string }) {
  const photos = v.photos.length ? v.photos : [""];
  const side = photos.length > 1 ? [1, 2].filter((i) => i < photos.length) : [];
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const show = (i: number) => {
    setIndex(i);
    setOpen(true);
  };
  const tile = (i: number, cls: string, first?: boolean) => (
    <button
      key={i}
      type="button"
      onClick={() => show(i)}
      aria-label={`Open photo ${i + 1} of ${photos.length}`}
      className={cn("group relative block h-full w-full overflow-hidden focus-visible:outline-none", cls)}
    >
      <CarImage
        src={photos[i] || undefined}
        alt={`${title}, photo ${i + 1}`}
        {...(first ? { make: v.make, model: v.model } : {})}
        aspect="16/9"
        className={cn("rounded-none", side.length > 0 && "md:aspect-auto md:h-full")}
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-ink/0 ring-inset ring-primary transition-colors duration-200 group-hover:bg-ink/10 group-focus-visible:ring-4"
      />
    </button>
  );
  return (
    <div className="relative">
      <div
        className={cn(
          "grid gap-2 overflow-hidden rounded-3xl",
          side.length > 0 && "md:h-[420px] md:grid-cols-[2fr_1fr] md:grid-rows-2 xl:h-[460px]",
        )}
      >
        {tile(0, "md:row-span-2", true)}
        {side.map((i) => tile(i, cn("hidden md:block", side.length === 1 && "md:row-span-2")))}
      </div>
      {photos.length > 1 && (
        <button
          type="button"
          onClick={() => show(index)}
          className="absolute bottom-4 right-4 inline-flex h-9 items-center gap-2 rounded-xl bg-white/95 px-3 text-sm font-semibold text-ink shadow-raised backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Images aria-hidden className="h-4 w-4" />
          <span className="num">All {photos.length} photos</span>
        </button>
      )}
      <Lightbox open={open} onClose={() => setOpen(false)} photos={photos} index={index} onIndex={setIndex} alt={title} />
    </div>
  );
}

/* ---------------------------------------------------------------- panels */

function PaymentPanel({ vehicle: v, actions }: { vehicle: PublicVehicle; actions: ReactNode }) {
  const price = v.price_cents / 100;
  const minDownPct = Number(v.min_down_pct);
  const terms = v.allowed_terms;
  const [downPct, setDownPct] = useState(minDownPct);
  const [term, setTerm] = useState(Math.max(...terms));
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const t = dealTerms({ priceCents: v.price_cents, downPct, apr: Number(v.apr), termMonths: term });
  const down = t.down / 100;
  const monthly = t.monthly / 100;
  const financed = t.financed / 100;
  const interest = t.interest / 100;
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-5 md:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="eyebrow font-sans text-muted">Estimated payment</h2>
          <p className="text-sm text-muted">
            Price <span className="num font-semibold text-ink">{money(price)}</span>
          </p>
        </div>
        <p aria-live="polite" className="num mt-3 font-display text-[44px] font-bold leading-none tracking-tight">
          ≈ {money(Math.round(monthly))}
          <span className="ml-1 text-base font-medium tracking-normal text-muted">/mo</span>
        </p>
        <p className="num mt-2 text-sm text-muted">
          {money(down)} down · {term} months · {percent(Number(v.apr))} rate
        </p>
        {actions && <div className="mt-5 hidden xl:block">{actions}</div>}
      </div>
      <div className="space-y-4 border-t border-ink/[0.08] p-5 md:p-6">
        <p className="text-sm font-semibold">Work out your payment</p>
        <div>
          <span className="text-sm text-muted">Down payment</span>
          <Slider
            label="Down payment percent"
            min={minDownPct}
            max={50}
            step={1}
            value={downPct}
            onChange={setDownPct}
            formatValue={(p) => `${p}% · ${money(Math.round((price * p) / 100))}`}
            className="px-10"
          />
        </div>
        <div>
          <span className="mb-2 block text-sm text-muted">Length</span>
          <Segmented
            label="Length"
            value={String(term)}
            onChange={(x) => setTerm(Number(x))}
            options={terms.map((m) => ({ value: String(m), label: `${m} mo` }))}
            className="flex w-full"
          />
        </div>
        <div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            {open ? "Hide the breakdown" : "See the full breakdown"}
            <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
          <div id={panelId} hidden={!open}>
            <Breakdown
              className="mt-2 text-[15px]"
              rows={[
                { label: "Monthly payment", value: money(monthly) },
                { label: "Down payment", value: money(down) },
                { label: "Amount financed", value: money(financed) },
                { label: "Total interest", value: money(interest) },
                { label: "Total you’d pay", value: money(down + monthly * term) },
              ]}
            />
          </div>
        </div>
      </div>
      <p className="border-t border-ink/[0.08] bg-surface/70 px-5 py-3 text-xs leading-5 text-muted md:px-6">
        Estimate only. Your final terms are agreed with the seller. No fees from OwnerFi for buyers.
      </p>
    </Card>
  );
}

function Overview({ vehicle: v }: { vehicle: PublicVehicle }) {
  const rows: [typeof Gauge, string, string][] = [
    [Gauge, "Mileage", miles(v.mileage)],
    [CalendarDays, "Year", String(v.year)],
    [SlidersHorizontal, "Body", bodyLabel(v.body) || "—"],
    [Wrench, "Condition", v.condition ? titleCase(v.condition) : "—"],
    [Palette, "Exterior", v.exterior_color ?? "—"],
    [Armchair, "Interior", v.interior_color ?? "—"],
    [MapPin, "Location", `${v.city}, ${v.state}`],
  ];
  return (
    <>
      <Card>
        <CardHeader title="Overview" />
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {rows.map(([Icon, label, value]) => (
            <div key={label} className="rounded-xl bg-surface px-3 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Icon aria-hidden className="h-4 w-4" />
                {label}
              </dt>
              <dd className="num mt-1 text-[15px] font-semibold leading-5">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <CardHeader title="About this car" description="In the seller’s words." />
        {v.description && <p className="text-[15px] leading-7 text-ink/90">{v.description}</p>}
        {v.features.length > 0 && (
          <>
            <h4 className="mt-5 text-sm font-semibold">Features</h4>
            <ul className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {v.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-[15px]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <Check aria-hidden className="h-3.5 w-3.5" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}

function Checks({ vehicle: v }: { vehicle: PublicVehicle }) {
  const h = v.history_summary ?? {};
  const clean = (h.title ?? "clean") === "clean";
  const items: [string, boolean][] = [
    ["Title is clear", clean],
    ["No theft report", true],
    ["Odometer looks right", (h.accidents ?? 0) < 3],
    ["No title brands", clean],
  ];
  return (
    <Card>
      <CardHeader
        title="Checks and history"
        description={`Checked by OwnerFi on ${new Date(v.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`}
      />
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map(([label, ok]) => (
          <li key={label} className="flex items-center gap-3 rounded-xl border border-ink/[0.08] px-3 py-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
              )}
            >
              {ok ? <ShieldCheck aria-hidden className="h-5 w-5" /> : <Clock aria-hidden className="h-5 w-5" />}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold leading-5">{label}</span>
              <span className={cn("block text-sm", ok ? "text-muted" : "text-warning")}>{ok ? "Passed" : "Under review"}</span>
            </span>
          </li>
        ))}
      </ul>
      {(h.owners !== undefined || h.accidents !== undefined) && (
        <p className="mt-4 text-sm text-muted">
          {h.owners !== undefined && (
            <>
              {h.owners} {h.owners === 1 ? "owner" : "owners"}
            </>
          )}
          {h.owners !== undefined && h.accidents !== undefined && " · "}
          {h.accidents !== undefined && <>{h.accidents === 0 ? "No accidents reported" : `${h.accidents} accident(s) reported`}</>}
        </p>
      )}
    </Card>
  );
}

function SellerCard({ vehicle: v }: { vehicle: PublicVehicle }) {
  const [first = "", last = ""] = v.seller_display_name.split(" ");
  const shortName = `${first} ${last.slice(0, 1)}${last ? "." : ""}`.trim();
  return (
    <Card>
      <CardHeader title="Meet the seller" />
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={shortName} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-6">{shortName}</p>
          <p className="num text-sm text-muted">Private seller · {v.state}</p>
          <p className="text-sm text-muted">
            On OwnerFi since {new Date(v.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        {v.seller_verified && <VerifiedSeller />}
      </div>
      <ul className="mt-5 grid gap-3 border-t border-ink/[0.08] pt-4 text-sm sm:grid-cols-2">
        {v.seller_verified && (
          <li className="flex items-start gap-2">
            <BadgeCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            OwnerFi checked their ID and their bank for payouts.
          </li>
        )}
        <li className="flex items-start gap-2">
          <KeyRound aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          They stay on the title until the car is paid off. Then it’s yours.
        </li>
      </ul>
    </Card>
  );
}

const BUY_STEPS = ["Ask a question", "Take a test drive", "Make an offer", "Inspect and sign"];
const BUY_POINTS = [
  "Verified seller",
  "Title and theft checked",
  "Mobile inspection before you sign",
  "OwnerFi never holds your money",
];

function HowBuying() {
  return (
    <Card>
      <CardHeader title="How buying works" description="The seller keeps the lien on the title until the car is paid off." />
      <ol className="grid gap-3 sm:grid-cols-4">
        {BUY_STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
            <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
              {i + 1}
            </span>
            <span className="text-[15px] font-semibold leading-5">{s}</span>
          </li>
        ))}
      </ol>
      <ul className="mt-5 grid gap-2 border-t border-ink/[0.08] pt-4 text-sm sm:grid-cols-2">
        {BUY_POINTS.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-success" />
            {p}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Similar({ vehicle: v }: { vehicle: PublicVehicle }) {
  // Not a suspense query: if the backend is slow the rest of the page must still show, and this row fills in later.
  const { data } = useQuery({ ...listQuery, staleTime: 60_000, retry: 0 });
  const { allVehicles } = useDemoStore();
  const similar = allVehicles(data?.vehicles ?? [])
    .filter((x) => x.id !== v.id && x.status === "listed" && (x.body === v.body || x.make === v.make))
    .slice(0, 3);
  if (!similar.length) return null;
  return (
    <section aria-labelledby="similar" className="mt-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 id="similar" className="text-xl font-bold leading-7 md:text-2xl md:leading-8">
            Similar cars
          </h2>
          <p className="mt-1 text-muted">Same body type or make, also on monthly payments.</p>
        </div>
        <AppLink to="/cars" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex">
          Browse all cars <ArrowRight aria-hidden className="h-4 w-4" />
        </AppLink>
      </div>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] md:gap-5 md:overflow-visible md:px-0 md:pb-0">
        {similar.map((c) => (
          <li key={c.id} className="flex w-72 shrink-0 snap-start md:w-auto [&>*]:flex-1">
            <CarCard vehicle={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ----------------------------------------------------------------- modals */

function AskModal({ vehicle: v, open, onClose }: { vehicle: PublicVehicle; open: boolean; onClose: () => void }) {
  const { createInquiry } = useDemoStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [text, setText] = useState("");
  if (!open) return null;
  const seller = v.seller_display_name.split(" ")[0] ?? "the seller";
  const QUICK = ["Is it still available?", "Can I see service records?", "Any accidents?", "Can I book a test drive?"];
  return (
    <Modal
      open
      onClose={onClose}
      title={`Ask ${seller} about the ${carTitle(v)}`}
      description={`${seller} usually replies within a day.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={text.trim().length < 5}
            onClick={() => {
              try {
                const dealId = createInquiry(v, text.trim());
                toast({ tone: "success", title: "Message sent" });
                onClose();
                navigate({ to: "/deals/$id", params: { id: dealId }, search: { as: "buyer" } as never });
              } catch (e) {
                toast({ tone: "danger", title: e instanceof Error ? e.message : "Couldn’t send your message." });
              }
            }}
          >
            Send message
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick questions">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setText(q)}
              className="min-h-9 rounded-full border border-ink/15 px-3 text-sm font-medium hover:bg-surface"
            >
              {q}
            </button>
          ))}
        </div>
        <TextArea
          label="Your message"
          rows={4}
          maxLength={1000}
          value={text}
          placeholder="Write your question…"
          onChange={(e) => setText(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/** Listings show "Maria A."; drives are stored under the full account name. */
const fullName = (display: string) => (display === "Maria A." ? "Maria Alvarez" : sellerFullName(display));

function TestDriveModal({
  vehicle: v,
  open,
  onClose,
  onAsk,
}: {
  vehicle: PublicVehicle;
  open: boolean;
  onClose: () => void;
  onAsk: () => void;
}) {
  const { bookTestDrive } = useDemoStore();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useCurrentUser();
  const availability = useAvailability();
  const drives = useDrives();
  const [step, setStep] = useState<"time" | "note">("time");
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const tomorrow = new Date(Date.now() + 86_400_000);
  const seller = fullName(v.seller_display_name);
  const slots = useMemo(
    () => openSlots(availability, drives.filter((d) => d.sellerName === seller), new Date(), new Date(Date.now() + 30 * 86_400_000)),
    [availability, drives, seller],
  );
  if (!open) return null;
  const first = v.seller_display_name.split(" ")[0] ?? "the seller";
  const picked = time ? new Date(time) : null;
  const slotLabel = picked ? format(picked, "EEE, MMM d · h:mm a") : "";

  return (
    <Modal
      open
      onClose={onClose}
      title={`Test drive the ${carTitle(v)}`}
      description={`Pick a day and time that works for you. ${first} will confirm.`}
      footer={
        step === "time" ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!time} onClick={() => setStep("note")}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep("time")}>
              Back
            </Button>
            <Button
              onClick={() => {
                try {
                  const dealId = bookTestDrive(v, slotLabel, `${v.city}, ${v.state}`);
                  requestDrive({
                    sellerName: seller,
                    buyerName: user?.name ?? "A buyer",
                    car: carTitle(v),
                    vehicleId: v.id,
                    dealId,
                    start: time!,
                    durationMin: availability.slotMin,
                    place: availability.place,
                    ...(note.trim() ? { note: note.trim() } : {}),
                  });
                  toast({ tone: "success", title: "Request sent", description: `${first} usually answers within a day.` });
                  onClose();
                  navigate({ to: "/deals/$id", params: { id: dealId }, search: { as: "buyer" } as never });
                } catch (e) {
                  toast({ tone: "danger", title: e instanceof Error ? e.message : "Couldn’t send your request." });
                }
              }}
            >
              Request test drive
            </Button>
          </>
        )
      }
    >
      {step === "time" ? (
        slots.length === 0 ? (
          <EmptyState
            icon={<CalendarDays aria-hidden className="h-6 w-6" />}
            title="No times open right now"
            description={`${first} hasn’t got free times in the next 30 days. Ask a question and they can offer some.`}
            action={
              <Button
                onClick={() => {
                  onClose();
                  onAsk();
                }}
              >
                Ask the seller
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <Calendar
              value={day}
              onChange={(d) => {
                setDay(d);
                setTime(null);
              }}
              minDate={tomorrow}
              availableDates={slots}
              disabledDate={(d) => !slots.some((x) => sameDay(x, d))}
              className="max-w-none"
            />
            {day ? (
              <TimeSlots
                label={`Times on ${format(day, "EEEE, MMM d")}`}
                slots={slots.filter((x) => sameDay(x, day)).map((x) => ({ id: x.toISOString(), label: format(x, "h:mm a") }))}
                value={time}
                onChange={setTime}
              />
            ) : (
              <p className="text-sm text-muted">Pick a day with a dot to see times.</p>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <p className="font-semibold">{slotLabel}</p>
          <TextArea
            label="Anything the seller should know? (optional)"
            value={note}
            maxLength={200}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
          />
          <Alert tone="info">
            Bring your driver’s licence. You’ll meet in a public place. The address shows up once {first} confirms. You can change or
            cancel up to {liveSettings().testDriveCancelHours} hours before.
          </Alert>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------- page */

function CarPage() {
  const { id } = Route.useParams();
  const loaderVehicle = Route.useLoaderData();
  const { customVehicles, withEdits } = useDemoStore();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const [askOpen, setAskOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);

  const v = withEdits(customVehicles.find((c) => c.id === id) || loaderVehicle);
  const gate = gateFor(user, v);
  const title = carFullTitle(v);
  const actions = {
    ask: () => setAskOpen(true),
    bookTestDrive: () => setDriveOpen(true),
    makeOffer: () => navigate({ to: "/cars/$id/offer", params: { id: v.id } }),
  };
  const onLogin = () => navigate({ to: "/auth/login", search: { next: href } as never });
  const block = (sticky: boolean) => <ActionBlock gate={gate} actions={actions} onLogin={onLogin} sticky={sticky} />;

  return (
    <SiteLayout>
      <div className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 pb-40 pt-6 md:px-6 md:pt-8 lg:px-8 xl:pb-16">
          <CarHeader vehicle={v} title={title} />
          {v.status === "reserved" && (
            <Alert tone="info" className="mb-5" title="Reserved">
              A buyer is in talks on this car right now.
            </Alert>
          )}
          <Gallery vehicle={v} title={title} />
          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <aside aria-label="Price and actions" className={cn("min-w-0 xl:sticky xl:order-last", STICKY_TOP)}>
              <PaymentPanel vehicle={v} actions={block(false)} />
            </aside>
            <div className="min-w-0">
              <h2 className="sr-only">About this car</h2>
              <div className="space-y-6">
                <Overview vehicle={v} />
                <Checks vehicle={v} />
                <SellerCard vehicle={v} />
                <HowBuying />
              </div>
            </div>
          </div>
          <Similar vehicle={v} />
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-raised backdrop-blur-md xl:hidden">
        <div className="mx-auto max-w-xl">{block(true)}</div>
      </div>
      <AskModal vehicle={v} open={askOpen} onClose={() => setAskOpen(false)} />
      <TestDriveModal vehicle={v} open={driveOpen} onClose={() => setDriveOpen(false)} onAsk={() => setAskOpen(true)} />
    </SiteLayout>
  );
}
