import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  BadgeCheck,
  Calendar,
  Check,
  Clock,
  DollarSign,
  FileText,
  Info,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { CarPhoto } from "@/components/site/CarPhoto";
import { PaymentCalculator } from "@/components/site/PaymentCalculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPublicVehicle, type PublicVehicle } from "@/lib/vehicles.functions";
import { dealTerms, fmtUsd, marketPosition, rateCapForState } from "@/lib/finance";
import { useDemoStore } from "@/lib/demo-store";
import { toast } from "sonner";

function findLocalCustomVehicle(id: string): PublicVehicle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ownerfi_demo_store_v2");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.customVehicles)) {
      const found = parsed.customVehicles.find((v: PublicVehicle) => v.id === id);
      if (found) return found;
    }
  } catch {
    // ignore
  }
  return null;
}

const carQuery = (id: string) =>
  queryOptions({
    queryKey: ["public-vehicle", id],
    queryFn: () => getPublicVehicle({ data: { id } }),
  });

export const Route = createFileRoute("/cars/$id")({
  loader: async ({ context, params }) => {
    // 1. First check if it's a locally created custom demo vehicle
    const local = findLocalCustomVehicle(params.id);
    if (local) return local;

    // 2. If it matches a UUID format, fetch from Supabase
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
    if (isUuid) {
      try {
        const v = await context.queryClient.ensureQueryData(carQuery(params.id));
        if (v) return v;
      } catch {
        // fall through to local check
      }
    }

    // 3. Fallback check for newly created car in current memory
    const fallback = findLocalCustomVehicle(params.id);
    if (fallback) return fallback;

    // If on server (SSR) and it's a demo vehicle id (e.g. starts with "v-demo-"), provide safe SSR stub so hard refresh doesn't 404
    if (typeof window === "undefined" && (params.id.startsWith("v-demo-") || !isUuid)) {
      return {
        id: params.id,
        seller_display_name: "Maria Alvarez",
        seller_verified: true,
        year: 2021,
        make: "Toyota",
        model: "Camry",
        trim: "SE Nightshade",
        body: "Sedan",
        mileage: 45000,
        exterior_color: "Silver",
        interior_color: "Black",
        condition: "Excellent",
        description: "One owner, non-smoker, clean title.",
        city: "Phoenix",
        state: "AZ",
        price_cents: 2100000,
        min_down_pct: 15,
        apr: 9,
        allowed_terms: [36, 48, 60],
        market_low_cents: 1950000,
        market_high_cents: 2250000,
        photos: ["https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=1200"],
        features: ["Apple CarPlay", "Lane Assist", "Backup Camera"],
        history_summary: { owners: 1, accidents: 0, title: "clean" },
        status: "listed",
        created_at: new Date().toISOString(),
      };
    }

    throw notFound();
  },
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

function CarPage() {
  const { id } = Route.useParams();
  const loaderVehicle = Route.useLoaderData();
  const { customVehicles, createInquiry, bookTestDrive, makeOffer } = useDemoStore();
  const navigate = useNavigate();

  // Dialog state
  const [askOpen, setAskOpen] = useState(false);
  const [testDriveOpen, setTestDriveOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);

  // Form states
  const [inquiryMsg, setInquiryMsg] = useState("Hi, is this car still available? I would like to review the seller financing terms.");
  const [selectedSlot, setSelectedSlot] = useState("Tomorrow · 2:00 PM");
  const [offerPriceDollars, setOfferPriceDollars] = useState(Math.round(loaderVehicle.price_cents / 100));
  const [offerDownPct, setOfferDownPct] = useState(loaderVehicle.min_down_pct || 15);
  const [offerTerm, setOfferTerm] = useState(
    loaderVehicle.allowed_terms.includes(48) ? 48 : (loaderVehicle.allowed_terms[0] ?? 36)
  );

  // Resolve custom vehicle from store if updated
  const v = customVehicles.find((c) => c.id === id) || loaderVehicle;

  const pos = v.market_low_cents && v.market_high_cents
    ? marketPosition(v.price_cents, { low: v.market_low_cents, high: v.market_high_cents })
    : null;
  const h = v.history_summary;

  // Live calculation for offer dialog
  const offerPriceCents = (Number(offerPriceDollars) || 0) * 100;
  const minRequiredDown = Number(v.min_down_pct) || 10;
  const stateCap = rateCapForState(v.state || "AZ");
  const isDownTooLow = offerDownPct < minRequiredDown;
  const isTermInvalid = !v.allowed_terms.includes(offerTerm);
  const isAprTooHigh = Number(v.apr) > stateCap;
  const isPriceInvalid = !offerPriceDollars || offerPriceDollars <= 0;

  const offerValidationError = isPriceInvalid
    ? "Please enter a valid purchase price."
    : isDownTooLow
      ? `Down payment cannot be below seller's minimum required ${minRequiredDown}%.`
      : isTermInvalid
        ? "Please select one of the seller's allowed loan terms."
        : isAprTooHigh
          ? `Seller rate (${v.apr}% APR) exceeds ${v.state} state usury cap of ${stateCap}%.`
          : null;

  const isOfferValid = !offerValidationError;

  const offerCalc = useMemo(() => {
    return dealTerms({
      priceCents: Math.max(0, offerPriceCents),
      downPct: Math.min(100, Math.max(0, offerDownPct)),
      apr: Number(v.apr),
      termMonths: offerTerm || 36,
    });
  }, [offerPriceCents, offerDownPct, v.apr, offerTerm]);

  // Action Handlers
  const handleSendInquiry = () => {
    const dealId = createInquiry(v, inquiryMsg);
    setAskOpen(false);
    toast.success("Message sent to seller!", {
      description: "An inquiry deal has been created in your Deal Room.",
      action: {
        label: "Open Deal Room",
        onClick: () => navigate({ to: "/deals/$id", params: { id: dealId }, search: { as: "buyer" } }),
      },
    });
  };

  const handleBookTestDrive = () => {
    const dealId = bookTestDrive(v, selectedSlot, `${v.city}, ${v.state}`);
    setTestDriveOpen(false);
    toast.success("Test drive booked!", {
      description: `Scheduled for ${selectedSlot} in ${v.city}. Opening Deal Room...`,
    });
    navigate({ to: "/deals/$id", params: { id: dealId }, search: { as: "buyer" } });
  };

  const handleMakeOffer = () => {
    if (!isOfferValid) {
      toast.error(offerValidationError || "Invalid offer terms");
      return;
    }
    const dealId = makeOffer(v, {
      priceCents: offerPriceCents,
      downPct: offerDownPct,
      apr: Number(v.apr),
      term: offerTerm,
    });
    setOfferOpen(false);
    toast.success("Financing offer submitted!", {
      description: `${fmtUsd(offerPriceCents)} with ${offerDownPct}% down. Opening Deal Room...`,
    });
    navigate({ to: "/deals/$id", params: { id: dealId }, search: { as: "buyer" } });
  };

  const testDriveSlots = [
    "Tomorrow · 10:30 AM",
    "Tomorrow · 2:00 PM",
    "Saturday · 11:30 AM",
    "Sunday · 3:00 PM",
  ];

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_380px]">
        {/* Left Column: Car Photos, Specs, Description */}
        <div className="space-y-6">
          <CarPhoto
            src={v.photos[0]}
            alt={`${v.year} ${v.make} ${v.model}`}
            className="aspect-[16/10] w-full rounded-[20px] shadow-sm"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                Seller Financed
              </span>
              {v.status === "reserved" && (
                <span className="rounded-full bg-warning/10 px-3 py-0.5 text-xs font-semibold text-warning">
                  Reserved
                </span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-bold text-ink">
              {v.year} {v.make} {v.model} <span className="font-normal text-muted-foreground">{v.trim}</span>
            </h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-4" /> {v.city}, {v.state} · {v.mileage.toLocaleString()} miles
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="money text-3xl font-bold text-ink">{fmtUsd(v.price_cents)}</span>
              {pos && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  pos === "above" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                }`}>
                  {pos === "below" ? "Below market" : pos === "fair" ? "Fair price" : "Above market"}
                </span>
              )}
            </div>
          </div>

          {/* History Summary */}
          <section className="card-surface p-5">
            <h2 className="font-semibold text-ink">Vehicle history summary</h2>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
              <Stat k="Owners" v={String(h.owners ?? "1")} />
              <Stat k="Accidents" v={String(h.accidents ?? "0")} />
              <Stat k="Title" v={h.title === "clean" ? "Clean title" : (h.title ?? "Clean")} />
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
              <ShieldCheck className="size-4" /> Lien-free, clean VIN scan, and not reported stolen
            </p>
          </section>

          {/* Description */}
          {v.description && (
            <section className="card-surface p-5">
              <h2 className="font-semibold text-ink">From the seller</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.description}</p>
            </section>
          )}

          {/* Features */}
          {v.features.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold text-ink">Included features</h2>
              <div className="flex flex-wrap gap-2">
                {v.features.map((f) => (
                  <span key={f} className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink">
                    ✓ {f}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Seller Verified Card */}
          <section className="flex items-center gap-4 rounded-2xl bg-surface p-5">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 font-bold text-primary">
              {v.seller_display_name[0]}
            </div>
            <div>
              <p className="font-semibold text-ink">{v.seller_display_name}</p>
              <p className="flex items-center gap-1 text-xs text-success">
                <BadgeCheck className="size-4" /> Identity & Payout account verified
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Private seller financing directly to you</p>
            </div>
          </section>
        </div>

        {/* Right Column: Payment Calculator & Interactive Buyer Actions */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <PaymentCalculator
            priceCents={v.price_cents}
            apr={Number(v.apr)}
            minDownPct={Number(v.min_down_pct)}
            terms={v.allowed_terms}
          />

          {/* Interactive Action Card */}
          <div className="card-surface space-y-3 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Next steps
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-success">
                <ShieldCheck className="size-3.5" /> Buyer Protected
              </span>
            </div>

            {/* CTA 1: Ask the Seller */}
            <Button
              className="w-full flex items-center justify-center gap-2"
              onClick={() => setAskOpen(true)}
            >
              <MessageSquare className="size-4" /> Ask the seller a question
            </Button>

            {/* CTAs 2 & 3: Test Drive and Make Offer */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="flex items-center justify-center gap-1.5"
                onClick={() => setTestDriveOpen(true)}
              >
                <Calendar className="size-4 text-primary" /> Test drive
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => setOfferOpen(true)}
              >
                <DollarSign className="size-4" /> Make offer
              </Button>
            </div>

            <p className="flex items-start gap-1.5 pt-1 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>OwnerFi provides contract, inspection and title escrow. No dealer markups.</span>
            </p>
          </div>
        </aside>
      </main>

      {/* Mobile Fixed Action Bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <Button variant="outline" className="flex-1" onClick={() => setTestDriveOpen(true)}>
          Test drive
        </Button>
        <Button className="flex-1" onClick={() => setOfferOpen(true)}>
          Make offer
        </Button>
      </div>

      {/* DIALOG 1: Ask the Seller */}
      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              Ask {v.seller_display_name} a question
            </DialogTitle>
            <DialogDescription>
              Inquire about {v.year} {v.make} {v.model}. Your message will open a shared deal room.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-ink">Your message</label>
            <textarea
              rows={4}
              value={inquiryMsg}
              onChange={(e) => setInquiryMsg(e.target.value)}
              className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Sellers typically respond within a couple of hours.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setAskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendInquiry}>
              Send message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Book Test Drive */}
      <Dialog open={testDriveOpen} onOpenChange={setTestDriveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="size-5 text-primary" />
              Schedule a test drive
            </DialogTitle>
            <DialogDescription>
              Select a mock time slot to inspect and test drive the {v.year} {v.make} {v.model}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-ink">Available time slots</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {testDriveSlots.map((slot) => {
                  const sel = selectedSlot === slot;
                  return (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-medium transition-all ${
                        sel
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                          : "border-border bg-surface text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <Clock className="size-3.5 shrink-0" />
                      <span>{slot}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-ink">Meeting location:</p>
              <p>{v.city}, {v.state} (Exact street address confirmed upon seller approval)</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setTestDriveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBookTestDrive}>
              Confirm test drive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Make Financing Offer */}
      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="size-5 text-primary" />
              Make a financing offer
            </DialogTitle>
            <DialogDescription>
              Propose your financing structure for this {v.year} {v.make} {v.model}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-ink">
                <span>Offer price</span>
                <span className="money font-bold text-primary">${offerPriceDollars.toLocaleString()}</span>
              </div>
              <Input
                type="number"
                value={offerPriceDollars}
                onChange={(e) => setOfferPriceDollars(Number(e.target.value))}
                step={250}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-ink">
                <span>Down payment ({offerDownPct}%)</span>
                <span className="money font-semibold text-ink">{fmtUsd(offerCalc.down)}</span>
              </div>
              <Slider
                value={[offerDownPct]}
                min={Number(v.min_down_pct) || 10}
                max={80}
                step={1}
                onValueChange={(val) => setOfferDownPct(val[0] ?? 15)}
              />
              <p className="text-[11px] text-muted-foreground">Seller requires at least {v.min_down_pct}% down.</p>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-ink">Loan term</span>
              <div className="flex flex-wrap gap-2">
                {v.allowed_terms.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setOfferTerm(t)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                      offerTerm === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {t} months
                  </button>
                ))}
              </div>
            </div>

            {/* Calculated Monthly affordability breakdown */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Your calculated monthly:</span>
                <span className="money text-2xl font-bold text-primary">
                  {fmtUsd(offerCalc.monthly, { cents: true })}/mo
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs border-t border-primary/10 pt-2 text-muted-foreground">
                <div>Amount financed: <span className="font-semibold text-ink">{fmtUsd(offerCalc.financed)}</span></div>
                <div>Seller APR: <span className="font-semibold text-ink">{v.apr}%</span></div>
                <div>Total interest: <span className="font-semibold text-ink">{fmtUsd(offerCalc.interest)}</span></div>
                <div>OwnerFi fee for you: <span className="font-semibold text-success">$0 (Free)</span></div>
              </div>
            </div>

            {offerValidationError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {offerValidationError}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOfferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMakeOffer} disabled={!isOfferValid} className="flex items-center gap-1.5">
              <Sparkles className="size-4" /> Submit offer & open deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className="font-semibold text-ink">{v}</p>
    </div>
  );
}
