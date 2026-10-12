import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import {
  Alert,
  Badge,
  Breakdown,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  Segmented,
  Skeleton,
  Slider,
  TextArea,
  TextInput,
} from "@/components/kit";
import { Stepper } from "@/components/kit-extra";
import { SiteLayout } from "@/components/site/SiteChrome";
import { CarImage, carFullTitle } from "@/components/site/cars";
import { useDemoStore } from "@/lib/demo-store";
import { rateCapForState } from "@/lib/finance";
import { money, percent } from "@/lib/format";
import { budgetFit, defaultOffer, offerNumbers, validateOffer, type OfferErrors, type OfferTerms } from "@/lib/offer";
import { useCurrentUser, useSessionReady } from "@/lib/session";
import { isDemoCarId, loadVehicle } from "@/lib/vehicle-loader";
import type { PublicVehicle } from "@/lib/vehicles.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cars/$id/offer")({
  validateSearch: (s: Record<string, unknown>): { step?: "review" } => (s["step"] === "review" ? { step: "review" } : {}),
  ssr: ({ params }) => params.status !== "success" || !isDemoCarId(params.value.id),
  loader: loadVehicle,
  head: () => ({ meta: [{ title: "Make an offer · OwnerFi" }] }),
  component: OfferPage,
  errorComponent: () => <p className="p-10 text-center">Couldn't load this car.</p>,
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <p className="text-lg font-semibold text-ink">This car isn’t available anymore.</p>
      <Link to="/cars" search={{}} className="mt-2 inline-block text-primary underline">
        Browse other cars
      </Link>
    </div>
  ),
});

const Frame = ({ children }: { children: ReactNode }) => (
  <SiteLayout>
    <div className="bg-surface">
      <div className="mx-auto max-w-[640px] px-4 pb-16 pt-6 md:px-6 md:pt-8 lg:px-8">{children}</div>
    </div>
  </SiteLayout>
);

const STEP_NAMES = ["Terms", "Review", "Sent"];

function OfferFrame({ step, vehicle, children }: { step: number; vehicle?: PublicVehicle; children: ReactNode }) {
  return (
    <Frame>
      {vehicle && (
        <Link
          to="/cars/$id"
          params={{ id: vehicle.id }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to the car
        </Link>
      )}
      <h1 className="mt-3 text-[28px] font-bold leading-9 md:text-[32px] md:leading-10">Make an offer</h1>
      <Stepper
        className="mb-6 mt-5"
        steps={STEP_NAMES.map((name, i) => ({
          id: name,
          label: name,
          state: i < step ? "done" : i === step ? "current" : "upcoming",
        }))}
      />
      {vehicle && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-ink/[0.08] bg-white p-3 shadow-card">
          <CarImage
            src={vehicle.photos[0]}
            alt=""
            make={vehicle.make}
            model={vehicle.model}
            className="h-12 w-16 shrink-0 rounded-xl"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold">{carFullTitle(vehicle)}</p>
            <p className="num truncate text-sm text-muted">
              Asking {money(vehicle.price_cents / 100)} · from {vehicle.min_down_pct}% down · {percent(Number(vehicle.apr))}
            </p>
          </div>
        </div>
      )}
      {children}
    </Frame>
  );
}

/* ------------------------------------------------------------ terms form */

const num = (v: string) => (v === "" ? 0 : Number(v));

function TermsEditor({
  value,
  onChange,
  vehicle: v,
  errors,
}: {
  value: OfferTerms;
  onChange: (t: OfferTerms) => void;
  vehicle: PublicVehicle;
  errors: OfferErrors;
}) {
  const cap = rateCapForState(v.state);
  const pct = value.price > 0 ? Math.round((value.downPayment / value.price) * 1000) / 10 : 0;
  const set = (p: Partial<OfferTerms>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-5">
      <TextInput
        label="Price"
        inputMode="decimal"
        type="number"
        min={0}
        leftAdornment="$"
        value={value.price || ""}
        onChange={(e) => set({ price: num(e.target.value) })}
        error={errors.price}
        helper={`Asking price is $${(v.price_cents / 100).toLocaleString("en-US")}.`}
      />
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <TextInput
          label="Down payment"
          inputMode="decimal"
          type="number"
          min={0}
          leftAdornment="$"
          value={value.downPayment || ""}
          onChange={(e) => set({ downPayment: num(e.target.value) })}
          error={errors.down}
          helper={`At least ${v.min_down_pct}%.`}
        />
        <TextInput
          label="Percent"
          inputMode="decimal"
          type="number"
          min={0}
          max={100}
          rightAdornment="%"
          value={pct || ""}
          onChange={(e) => set({ downPayment: Math.round((value.price * num(e.target.value)) / 100) })}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Length of the loan</p>
        <Segmented
          label="Length of the loan"
          options={v.allowed_terms.map((m) => ({ value: String(m), label: `${m} mo` }))}
          value={String(value.termMonths)}
          onChange={(x) => set({ termMonths: Number(x) })}
          className="flex w-full"
        />
        {errors.termMonths && <p className="mt-1 text-sm text-danger">{errors.termMonths}</p>}
      </div>
      <div>
        <Slider
          label="Interest rate"
          min={0}
          max={cap}
          step={0.25}
          value={Math.min(value.apr, cap)}
          onChange={(apr) => set({ apr })}
          formatValue={percent}
          marker={{ value: Math.min(Number(v.apr), cap), label: `Seller’s rate ${percent(Number(v.apr))}` }}
        />
        <p className="mt-1 text-sm text-muted">{errors.apr ?? `Between ${percent(Number(v.apr))} and ${percent(cap)} here.`}</p>
      </div>
    </div>
  );
}

function YourNumbers({ terms, ok }: { terms: OfferTerms; ok: boolean }) {
  if (!ok) {
    return <p className="text-muted">Enter a price and a down payment to see the numbers.</p>;
  }
  const n = offerNumbers(terms);
  return (
    <div>
      <p className="text-sm text-muted">Your monthly payment</p>
      <p aria-live="polite" className="num text-3xl font-bold">
        {money(n.monthly)}
        <span className="text-base font-normal text-muted"> / month</span>
      </p>
      <Breakdown
        rows={[
          { label: "Amount financed", value: money(n.financed) },
          { label: "Total interest", value: money(n.interest) },
          { label: "Down payment", value: money(terms.downPayment) },
        ]}
        total={{ label: "Total you’ll pay", value: money(n.buyerTotal) }}
      />
    </div>
  );
}

const BANDS = [
  { id: "comfortable", label: "Comfortable", text: "Looks comfortable.", tone: "success" as const },
  { id: "tight", label: "Tight", text: "It could feel tight each month.", tone: "warning" as const },
  { id: "stretch", label: "Stretch", text: "This is a stretch. Consider a bigger down payment.", tone: "danger" as const },
];

function BudgetFit({ monthly }: { monthly: number }) {
  const fit = budgetFit(monthly);
  const idx = BANDS.findIndex((b) => b.id === fit.band);
  const band = BANDS[idx]!;
  const d = fit.dtiAfter;
  const raw = d < 36 ? (d / 36) * 33.3 : d <= 45 ? 33.3 + ((d - 36) / 9) * 33.3 : 66.6 + (Math.min(15, d - 45) / 15) * 33.3;
  const marker = Math.min(98, Math.max(2, raw));
  return (
    <div className="border-t border-ink/[0.08] pt-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">How it fits your budget</p>
        <Badge tone={band.tone}>{band.label}</Badge>
      </div>
      <div
        role="meter"
        aria-label="How this payment fits your budget"
        aria-valuemin={0}
        aria-valuemax={60}
        aria-valuenow={Math.min(60, d)}
        aria-valuetext={`${band.label}. About ${d}% of income goes to debts.`}
        className="relative grid grid-cols-3 gap-1"
      >
        {BANDS.map((b, i) => (
          <span key={b.id} className={cn("h-2 rounded-full", i <= idx ? "bg-primary" : "bg-ink/10")} />
        ))}
        <span
          aria-hidden
          className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded bg-ink ring-2 ring-white"
          style={{ left: `${marker}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        About {d}% of your income would go to debts, including this car. {band.text}
      </p>
      <p className="mt-1 text-xs text-muted">A rough estimate from your credit check. It’s not a decision.</p>
    </div>
  );
}

/* --------------------------------------------------------------- review */

const SELLER_SEES = [
  "Your name and that your ID is checked",
  "That your bank account is linked",
  "Your credit range, how much credit you use, and missed payments",
];

function Review({
  terms,
  note,
  consent,
  onConsent,
  onChange,
  error,
}: {
  terms: OfferTerms;
  note: string;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onChange: () => void;
  error?: string | undefined;
}) {
  const n = offerNumbers(terms);
  return (
    <>
      <CardHeader title="Check and send" description="Look over your offer, then agree and send." />
      <div className="space-y-6">
        <section className="rounded-2xl bg-surface p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <h4 className="eyebrow text-muted">Your offer</h4>
            <Button variant="ghost" size="sm" className="-mr-2 -mt-2" onClick={onChange}>
              Change
            </Button>
          </div>
          <p className="num font-display text-[32px] font-bold leading-none tracking-tight">{money(terms.price)}</p>
          <p className="mt-2 text-muted">
            {money(terms.downPayment)} down, then <span className="num font-semibold text-ink">{money(n.monthly)}</span> a
            month for {terms.termMonths} months at {percent(terms.apr)}.
          </p>
          {note && <p className="mt-3 border-l-2 border-ink/15 pl-3 text-muted">“{note}”</p>}
        </section>
        <section>
          <h4 className="font-semibold">What the seller sees</h4>
          <ul className="mt-2 space-y-2">
            {SELLER_SEES.map((s) => (
              <li key={s} className="flex gap-2">
                <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">They never see your Social Security number, birthday or account numbers.</p>
        </section>
        <div className="rounded-2xl border border-ink/10 p-4">
          <Checkbox
            checked={consent}
            onChange={(e) => onConsent(e.target.checked)}
            label="I agree OwnerFi can run a soft credit check."
            description="It won’t affect your credit score."
          />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted">
          <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-success" />
          OwnerFi never holds your money. You pay the seller directly.
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </>
  );
}

const AFTER_SEND = ["Offer sent", "Seller reviews it", "You agree on terms", "Inspection"];

function Sent({ dealId }: { dealId: string }) {
  return (
    <Card className="px-6 py-10 text-center md:px-10" role="status">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 text-success ring-8 ring-success/5">
        <CheckCircle2 aria-hidden className="h-8 w-8" />
      </span>
      <h2 className="mt-5 text-2xl font-bold">Offer sent</h2>
      <p className="mx-auto mt-1 max-w-sm text-muted">Sellers usually respond within 24 hours. We’ll tell you when they do.</p>
      <ol className="mx-auto mt-8 max-w-xs text-left">
        {AFTER_SEND.map((s, i) => (
          <li key={s} className="relative flex items-center gap-3 pb-4 last:pb-0">
            {i < AFTER_SEND.length - 1 && (
              <span aria-hidden className="absolute left-3 top-7 h-[calc(100%-1.75rem)] w-px bg-ink/10" />
            )}
            <span
              className={cn(
                "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                i === 0 ? "bg-primary text-white" : "bg-ink/[0.06] text-muted",
              )}
            >
              {i === 0 ? <Check aria-hidden className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={i === 0 ? "font-semibold" : "text-muted"}>{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <ButtonLink to={`/deals/${dealId}?as=buyer`}>View my deal</ButtonLink>
        <ButtonLink to="/cars" variant="secondary">
          Keep browsing
        </ButtonLink>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ page */

function Blocked({ title, description, action }: { title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <Frame>
      <Card className="py-6">
        <EmptyState headingLevel={1} icon={<Lock aria-hidden className="h-6 w-6" />} title={title} description={description} action={action} />
      </Card>
    </Frame>
  );
}

function OfferPage() {
  const v = Route.useLoaderData();
  const { step: stepParam } = Route.useSearch();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const ready = useSessionReady();
  const { makeOffer, deals } = useDemoStore();
  const [terms, setTerms] = useState<OfferTerms>(() => defaultOffer(v));
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [dealId, setDealId] = useState<string | undefined>();

  if (!ready) {
    return (
      <Frame>
        <div aria-busy="true" aria-label="Loading offer" className="space-y-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-10" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </Frame>
    );
  }
  if (dealId) {
    return (
      <OfferFrame step={2}>
        <Sent dealId={dealId} />
      </OfferFrame>
    );
  }
  if (!user) {
    return <Navigate to="/auth/login" search={{ next: `/cars/${v.id}/offer` }} replace />;
  }
  if (user.role !== "buyer") {
    return (
      <Blocked
        title="Offers are for buyers"
        description="Switch to a buyer account to make an offer."
        action={<ButtonLink to={`/cars/${v.id}`}>Back to the car</ButtonLink>}
      />
    );
  }
  const existing = deals.find((d) => d.buyer === "Daniel Park" && d.car.includes(v.model) && d.car.includes(String(v.year)) && !["declined", "cancelled", "paid_off"].includes(d.stage));
  if (existing && !busy) {
    return <Navigate to="/deals/$id" params={{ id: existing.id }} search={{ as: "buyer" } as never} replace />;
  }
  if (v.status !== "listed") {
    return (
      <Blocked
        title="This car isn’t taking offers right now"
        description={v.status === "reserved" ? "Another buyer is in talks on it." : "It may be sold or taken down. Have a look at other cars."}
        action={<ButtonLink to="/cars">Browse cars</ButtonLink>}
      />
    );
  }
  if (!user.emailVerified || user.verification.bank !== "verified" || user.verification.credit !== "verified" || user.verification.identity !== "verified") {
    return (
      <Blocked
        title="One thing before you make an offer"
        description="Finish verifying your account first."
        action={<ButtonLink to="/buyer/verification">Continue verification</ButtonLink>}
      />
    );
  }

  const check = validateOffer(terms, v);
  const step = stepParam === "review" && check.ok ? 1 : 0;
  const goStep = (s: "terms" | "review") =>
    navigate({ to: "/cars/$id/offer", params: { id: v.id }, search: s === "review" ? { step: "review" } : {}, replace: false });

  const send = () => {
    setBusy(true);
    setError(undefined);
    try {
      const id = makeOffer(v, {
        priceCents: Math.round(terms.price * 100),
        downPct: (terms.downPayment / terms.price) * 100,
        apr: terms.apr,
        term: terms.termMonths,
      });
      setDealId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  const monthly = check.ok ? offerNumbers(terms).monthly : undefined;
  const reason =
    step === 0 && !check.ok
      ? (Object.values(check.errors)[0] as string | undefined)
      : step === 1 && !consent
        ? "Tick the box to agree to the soft credit check."
        : undefined;
  const canGo = step === 0 ? check.ok : consent;

  return (
    <OfferFrame step={step} vehicle={v}>
      <div className="space-y-5">
        <Card>
          {step === 0 ? (
            <>
              <CardHeader
                title="Your terms"
                description="Start with the seller’s terms or change them. The seller can say yes, counter or decline."
              />
              <div className="space-y-5">
                <TermsEditor value={terms} onChange={setTerms} vehicle={v} errors={check.errors} />
                <TextArea
                  label="Note to the seller (optional)"
                  rows={3}
                  maxLength={300}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  helper="Say hello, or why these terms work for you."
                />
              </div>
            </>
          ) : (
            <Review
              terms={terms}
              note={note}
              consent={consent}
              onConsent={setConsent}
              onChange={() => goStep("terms")}
              error={error}
            />
          )}
        </Card>
        <Card>
          <CardHeader title="Your numbers" description="Updates as you change the terms." />
          <div className="space-y-5">
            <YourNumbers terms={terms} ok={check.ok} />
            {check.ok && monthly !== undefined && <BudgetFit monthly={monthly} />}
          </div>
        </Card>
      </div>

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 mt-6 lg:bottom-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/[0.08] bg-white/95 p-3 shadow-raised backdrop-blur-md">
          <Button variant="secondary" onClick={() => (step === 0 ? history.back() : goStep("terms"))}>
            Back
          </Button>
          {reason && (
            <p className="order-first flex w-full items-start gap-2 text-sm text-muted sm:order-none sm:w-auto sm:flex-1">
              <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              {reason}
            </p>
          )}
          {monthly !== undefined && (
            <p className={cn("num hidden text-right leading-tight sm:block", !reason && "ml-auto")}>
              <span className="block text-xs text-muted">Monthly payment</span>
              <span className="font-display text-lg font-bold">{money(monthly)}</span>
            </p>
          )}
          <Button
            className={cn("flex-1 sm:flex-none", monthly === undefined && "ml-auto")}
            disabled={!canGo}
            loading={step === 1 && busy}
            onClick={step === 0 ? () => goStep("review") : send}
          >
            {step === 0 ? "Continue" : "Send offer"}
          </Button>
        </div>
      </div>
    </OfferFrame>
  );
}

