import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  Car,
  Check,
  FilePenLine,
  KeyRound,
  Landmark,
  Link2,
  Megaphone,
  ScanSearch,
  ScrollText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  UserCheck,
} from "lucide-react";
import {
  Accordion,
  AppLink,
  Breakdown,
  ButtonLink,
  Card,
  NativeSelect,
  Segmented,
  Slider,
  TextInput,
} from "@/components/kit";
import { SiteLayout } from "@/components/site/SiteChrome";
import { useAuth } from "@/lib/auth-store";
import { DEFAULT_STATE_RULES, dealTerms, rateCapForState } from "@/lib/finance";
import { money, moneyC, percent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sell your car. Be the bank. · OwnerFi" },
      {
        name: "description",
        content:
          "Sell your car on monthly payments to a verified buyer. You stay on the title until it’s paid off, and you earn interest on top of your price.",
      },
      { property: "og:title", content: "Sell your car. Be the bank. · OwnerFi" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

/* ------------------------------------------------------------ calculator */

const MIN_PRICE = 5_000;
const MAX_PRICE = 60_000;
const START = { price: 22_000, downPct: 15, apr: 10, termMonths: 48, state: "AZ" };

type CalcInput = typeof START;

function earnings(input: CalcInput) {
  const price = Math.min(Math.max(input.price, MIN_PRICE), MAX_PRICE);
  const apr = Math.min(input.apr, rateCapForState(input.state));
  const t = dealTerms({ priceCents: price * 100, downPct: input.downPct, apr, termMonths: input.termMonths });
  const rows = [
    { label: "Down payment from your buyer", value: moneyC(t.down) },
    { label: "OwnerFi fee", hint: "10% of the down payment", value: `−${moneyC(t.fee)}`, tone: "negative" as const },
    { label: "You receive at signing", value: moneyC(t.sellerNet) },
    {
      label: "Monthly payment from your buyer",
      hint: "Goes straight to you. No OwnerFi fee.",
      value: moneyC(t.monthly),
    },
    { label: "Interest you earn", value: moneyC(t.interest) },
  ];
  return { ...t, apr, rows, total: { label: "Your total proceeds", value: moneyC(t.sellerTotal) } };
}

/* -------------------------------------------------------------- sections */

function SectionShell({
  id,
  tone = "white",
  eyebrow,
  title,
  lead,
  layout = "stack",
  aside,
  children,
  className,
}: {
  id?: string;
  tone?: "white" | "surface";
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  layout?: "stack" | "center" | "side";
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const uid = useId();
  const head = (
    <div className={cn(layout === "center" && "mx-auto max-w-2xl text-center")}>
      <p className="eyebrow text-primary-700">{eyebrow}</p>
      <h2 id={uid} className="mt-3 text-balance text-[28px] font-bold leading-[1.15] text-ink md:text-[40px]">
        {title}
      </h2>
      {lead && (
        <p className={cn("mt-4 text-pretty text-[17px] leading-7 text-muted", layout === "center" ? "mx-auto max-w-xl" : "max-w-xl")}>
          {lead}
        </p>
      )}
    </div>
  );
  return (
    <section id={id} aria-labelledby={uid} className={cn("scroll-mt-20", tone === "surface" ? "bg-surface" : "bg-white", className)}>
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24 lg:px-8">
        {layout === "side" ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-0">
            {head}
            <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">{children}</div>
            {aside && <div className="lg:col-start-1 lg:row-start-2 lg:mt-8">{aside}</div>}
          </div>
        ) : (
          <>
            {head}
            <div className="mt-10 md:mt-14">{children}</div>
          </>
        )}
      </div>
    </section>
  );
}

const ICON_TILE = "flex shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700";
const GHOST_ON_DARK = "border border-white/25 bg-white/[0.06] text-white hover:border-white/40 hover:bg-white/[0.12]";

/* ------------------------------------------------------------------ hero */

function HeroNote() {
  const e = earnings(START);
  const chips = [`${START.downPct}% down`, `${percent(e.apr)} rate`, `${START.termMonths} months`];
  return (
    <figure
      aria-labelledby="hero-note-title"
      className="relative overflow-hidden rounded-3xl bg-white text-ink shadow-raised"
    >
      <div aria-hidden className="h-1.5 bg-primary" />
      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="hero-note-title" className="eyebrow text-muted">
              Sample note · {money(START.price)} car
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Terms">
              {chips.map((c) => (
                <li key={c} className="num rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-4 ring-primary-50/50">
            <Landmark aria-hidden className="h-5 w-5" />
          </span>
        </div>
        <Breakdown className="mt-5 border-t border-ink/10 pt-3" rows={e.rows} />
        <div className="mt-4 border-t border-dashed border-ink/15 pt-5">
          <p className="text-sm font-semibold text-muted">{e.total.label}</p>
          <p className="num mt-1 font-display text-[40px] font-bold leading-none tracking-tight md:text-[44px]">
            {e.total.value}
          </p>
          <p className="mt-2 text-sm text-muted">Your price plus interest, minus OwnerFi’s fee.</p>
        </div>
      </div>
      <figcaption className="flex items-center gap-2 border-t border-ink/[0.08] bg-surface px-6 py-3 text-sm text-muted md:px-8">
        <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-primary" />
        OwnerFi never holds your money.
      </figcaption>
    </figure>
  );
}

const HERO_POINTS = ["Buyers verified", "Title & theft checked", "You keep the title"];

function Hero() {
  const { user } = useAuth();
  const arrow = <ArrowRight aria-hidden className="h-5 w-5" />;
  return (
    <section aria-labelledby="hero-title" className="bg-ink bg-brand-glow text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16 lg:px-8">
        <div>
          <p className="eyebrow text-sky">Seller financing, done safely</p>
          <h1
            id="hero-title"
            className="mt-5 text-[44px] font-bold leading-[1.02] tracking-[-0.03em] md:text-[56px] lg:text-[64px]"
          >
            Sell your car.
            <br />
            <span className="text-sky">Be the bank.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
            Sell your car on monthly payments to a verified buyer. You stay on the title until it’s paid off, and you
            earn interest on top of your price.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            {user ? (
              <ButtonLink to={`/${user.role}`} variant="accent" size="lg" rightIcon={arrow}>
                Go to my portal
              </ButtonLink>
            ) : (
              <ButtonLink to="/auth/signup" variant="accent" size="lg" rightIcon={arrow}>
                Sell your car
              </ButtonLink>
            )}
            <ButtonLink to="/cars" variant="ghost" size="lg" className={GHOST_ON_DARK}>
              Browse cars
            </ButtonLink>
          </div>
          <ul className="mt-10 flex flex-col gap-3 text-sm text-white/75 sm:flex-row sm:flex-wrap sm:gap-x-7">
            {HERO_POINTS.map((p) => (
              <li key={p} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <Check aria-hidden strokeWidth={3} className="h-3 w-3 text-sky" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <HeroNote />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- how it works */

const STEPS = [
  { icon: Car, title: "List your car", body: "Add your VIN. We check the title and make sure the car is clear to sell." },
  { icon: Megaphone, title: "Advertise it", body: "Post to popular car sites, or share your own link." },
  { icon: CalendarCheck, title: "Meet verified buyers", body: "Buyers ask questions and book test drives. Every buyer is ID-checked." },
  { icon: UserCheck, title: "Approve a buyer", body: "See their risk profile, then say yes, counter or no." },
  { icon: SlidersHorizontal, title: "Agree the terms", body: "Price, down payment, rate and length. You set them." },
  { icon: FilePenLine, title: "Inspect and sign", body: "A mobile inspector checks the car. Then you both sign online." },
  { icon: Banknote, title: "Get the down payment", body: "Your buyer pays in the app. You hand over the car and move the title at the DMV." },
  { icon: Landmark, title: "Get paid monthly", body: "Payments land in your account. At payoff, you release the lien." },
];

const STEP_GROUPS = [
  { title: "Find your buyer", steps: STEPS.slice(0, 4), start: 1 },
  { title: "Close and get paid", steps: STEPS.slice(4), start: 5 },
];

function HowItWorks() {
  return (
    <SectionShell
      id="how-it-works"
      eyebrow="How it works"
      title="From listing to your last payment"
      lead="Eight steps, and we guide you through each one. You stay in control the whole way."
    >
      <div className="space-y-12 md:space-y-14">
        {STEP_GROUPS.map((g) => (
          <div key={g.title}>
            <div className="flex items-center gap-4">
              <h3 className="eyebrow shrink-0 text-muted">{g.title}</h3>
              <span aria-hidden className="h-px flex-1 bg-ink/10" />
            </div>
            <ol start={g.start} className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {g.steps.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="relative">
                  <div className="flex items-center gap-3">
                    <span className={cn(ICON_TILE, "relative h-12 w-12")}>
                      <Icon aria-hidden className="h-[22px] w-[22px]" />
                      <span
                        aria-hidden
                        className="num absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-1.5 font-display text-xs font-bold text-white ring-2 ring-white"
                      >
                        {g.start + i}
                      </span>
                    </span>
                    {i < g.steps.length - 1 && <span aria-hidden className="hidden h-px flex-1 bg-ink/10 lg:block" />}
                  </div>
                  <h4 className="mt-5 text-[17px] font-semibold leading-6">
                    <span className="sr-only">Step {g.start + i}: </span>
                    {title}
                  </h4>
                  <p className="mt-2 text-[15px] leading-6 text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------ calculator */

function Calculator() {
  const [v, setV] = useState<CalcInput>(START);
  const [priceText, setPriceText] = useState(String(START.price));
  const out = earnings(v);
  const cap = rateCapForState(v.state);
  const patch = (p: Partial<CalcInput>) => setV((s) => ({ ...s, ...p }));
  const priceBad = Number(priceText) < MIN_PRICE || Number(priceText) > MAX_PRICE;
  const label = "mb-2 block text-sm font-semibold";

  return (
    <SectionShell
      id="calculator"
      tone="surface"
      eyebrow="What you earn"
      title="See what you’d earn"
      lead="Move the sliders. The numbers update as you go."
      layout="center"
    >
      <Card className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-4 lg:p-3">
        <div className="space-y-7 lg:p-7">
          <div>
            <TextInput
              label="Sale price"
              inputMode="numeric"
              leftAdornment="$"
              value={priceText}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setPriceText(digits);
                if (digits) patch({ price: Math.min(Math.max(Number(digits), MIN_PRICE), MAX_PRICE) });
              }}
              onBlur={() => setPriceText(String(v.price))}
              helper={priceBad ? `Between ${money(MIN_PRICE)} and ${money(MAX_PRICE)}` : undefined}
            />
            <Slider
              label="Sale price"
              min={MIN_PRICE}
              max={MAX_PRICE}
              step={500}
              value={v.price}
              onChange={(n) => {
                patch({ price: n });
                setPriceText(String(n));
              }}
              formatValue={money}
            />
          </div>
          <div>
            <span className={label}>Down payment</span>
            <Segmented
              label="Down payment"
              className="flex w-full"
              value={String(v.downPct)}
              onChange={(x) => patch({ downPct: Number(x) })}
              options={["10", "15", "20", "25"].map((x) => ({ value: x, label: `${x}%` }))}
            />
          </div>
          <div>
            <span className={label}>Length</span>
            <Segmented
              label="Length"
              className="flex w-full"
              value={String(v.termMonths)}
              onChange={(x) => patch({ termMonths: Number(x) })}
              options={["24", "36", "48", "60"].map((x) => ({ value: x, label: `${x} mo` }))}
            />
          </div>
          <div>
            <span className={label}>Interest rate (APR)</span>
            <Slider
              label="Interest rate"
              min={0}
              max={cap}
              step={0.5}
              value={out.apr}
              onChange={(n) => patch({ apr: n })}
              formatValue={percent}
            />
            <p className="mt-1 text-sm text-muted">
              Highest rate allowed in {v.state === "other" ? "your state" : v.state}: {cap}%
            </p>
          </div>
          <NativeSelect
            label="Your state"
            value={v.state}
            onChange={(e) => {
              const state = e.target.value;
              patch({ state, apr: Math.min(v.apr, rateCapForState(state)) });
            }}
            options={DEFAULT_STATE_RULES.map((r) => ({
              value: r.state,
              label: r.state === "other" ? "Another state" : r.state,
            }))}
          />
        </div>

        <div className="flex flex-col rounded-2xl bg-surface p-5 md:p-7 lg:p-8">
          <div aria-live="polite" aria-atomic="true">
            <p className="eyebrow text-muted">{out.total.label}</p>
            <p className="num mt-2 font-display text-[40px] font-bold leading-none tracking-tight text-ink md:text-[48px]">
              {out.total.value}
            </p>
            <p className="mt-3 text-[15px] text-muted">
              That’s <span className="num font-semibold text-ink">{moneyC(out.sellerNet)}</span> at signing, then{" "}
              <span className="num font-semibold text-ink">{moneyC(out.monthly)}</span> a month for {v.termMonths} months.
            </p>
          </div>
          <Breakdown className="mt-6 border-t border-ink/10 pt-3" rows={out.rows} />
          <p className="mt-4 text-sm leading-6 text-muted">
            OwnerFi’s fee is 10% of the down payment, paid when your buyer pays it in the app. Monthly payments go
            straight to you.
          </p>
          <div className="mt-6 lg:mt-auto lg:pt-6">
            <ButtonLink
              to="/auth/signup?role=seller"
              rightIcon={<ArrowRight aria-hidden className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Start selling
            </ButtonLink>
          </div>
        </div>
      </Card>
    </SectionShell>
  );
}

/* ------------------------------------------------------------ protection */

const PROTECTIONS = [
  { icon: ShieldCheck, title: "Verified buyers", body: "Every buyer verifies their ID, connects a bank and agrees to a soft credit check." },
  { icon: ScanSearch, title: "Title & theft checks", body: "We check the VIN before a car can be listed. Liens, theft flags and branded titles are blocked." },
  { icon: Truck, title: "Mobile inspection", body: "An inspector looks at the car before anyone signs. Everyone sees the report." },
  { icon: ScrollText, title: "Contracts & lien", body: "We write the documents and you both e-sign. You stay on the title until it’s paid off." },
];

function Protections() {
  return (
    <SectionShell
      id="protections"
      eyebrow="Protection"
      title="Protected at every step"
      lead="We check the car, the buyer and the paperwork, so you can say yes with confidence."
      layout="side"
      aside={
        <div className="flex items-start gap-4 rounded-2xl bg-surface p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary-700 shadow-card">
            <Landmark aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">OwnerFi never holds your money.</p>
            <p className="mt-1 text-[15px] leading-6 text-muted">Payments go from your buyer straight to your bank.</p>
          </div>
        </div>
      }
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {PROTECTIONS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-2xl border border-ink/[0.08] bg-white p-6 shadow-card">
            <span className={cn(ICON_TILE, "h-12 w-12")}>
              <Icon aria-hidden className="h-[22px] w-[22px]" />
            </span>
            <h3 className="mt-5 text-[17px] font-semibold leading-6">{title}</h3>
            <p className="mt-2 text-[15px] leading-6 text-muted">{body}</p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/* -------------------------------------------------------------- audience */

const AUDIENCES = [
  {
    key: "seller",
    icon: KeyRound,
    title: "For sellers",
    line: "Turn the car you’re selling into monthly income.",
    to: "/auth/signup?role=seller",
    cta: "Start selling",
    points: [
      "Set your own price and rate",
      "Earn interest on top of your price",
      "Stay on the title until paid off",
      "Get paid straight to your bank",
    ],
  },
  {
    key: "buyer",
    icon: Search,
    title: "For buyers",
    line: "Get a car on monthly payments, no bank needed.",
    to: "/cars",
    cta: "Find a car",
    points: [
      "Buy from a private seller, no dealer",
      "See your monthly payment up front",
      "Get the car inspected before you sign",
      "No OwnerFi fees for you",
    ],
  },
];

function Audience() {
  return (
    <SectionShell
      tone="surface"
      eyebrow="Who it’s for"
      title="A fair deal on both sides"
      lead="Sellers earn interest on top of their price. Buyers get a car without a bank."
      layout="center"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {AUDIENCES.map(({ key, icon: Icon, title, line, to, cta, points }) => {
          const dark = key === "seller";
          return (
            <article
              key={key}
              aria-labelledby={`aud-${key}`}
              className={cn(
                "flex flex-col rounded-3xl p-7 md:p-10",
                dark ? "bg-ink bg-brand-glow text-white" : "border border-ink/[0.08] bg-white shadow-card",
              )}
            >
              <span
                className={cn(
                  "h-12 w-12",
                  dark ? "flex items-center justify-center rounded-xl bg-white/[0.08] text-sky ring-1 ring-white/10" : ICON_TILE,
                )}
              >
                <Icon aria-hidden className="h-[22px] w-[22px]" />
              </span>
              <h3 id={`aud-${key}`} className="mt-6 font-display text-[26px] font-bold leading-8">
                {title}
              </h3>
              <p className={cn("mt-2 text-[17px] leading-7", dark ? "text-white/70" : "text-muted")}>{line}</p>
              <ul className="mt-7 flex-1 space-y-3.5">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-[15px] leading-6">
                    <Check
                      aria-hidden
                      strokeWidth={2.5}
                      className={cn("mt-0.5 h-5 w-5 shrink-0", dark ? "text-sky" : "text-primary")}
                    />
                    {p}
                  </li>
                ))}
              </ul>
              <ButtonLink
                to={to}
                size="lg"
                variant={dark ? "accent" : "primary"}
                rightIcon={<ArrowRight aria-hidden className="h-5 w-5" />}
                className="mt-9 sm:self-start"
              >
                {cta}
              </ButtonLink>
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}

/* --------------------------------------------------------------- pricing */

function Pricing() {
  const e = earnings(START);
  const rows = [
    { value: "10%", title: "of the down payment", body: "Paid by the seller, taken when the buyer pays the down payment in the app." },
    { value: "$0", title: "on monthly payments", body: "They go straight from buyer to seller." },
    { value: "$0", title: "for buyers", body: "Buyers pay no OwnerFi fees." },
  ];
  return (
    <SectionShell
      id="fees"
      eyebrow="Pricing"
      title="No listing fees. No monthly cut."
      lead="You pay OwnerFi once, when your buyer pays the down payment. That’s it."
      layout="side"
      aside={
        <div className="rounded-2xl bg-surface p-5 md:p-6">
          <p className="eyebrow text-muted">
            Example · {money(START.price)} car, {START.downPct}% down
          </p>
          <Breakdown className="mt-2" rows={e.rows.slice(0, 3)} />
        </div>
      }
    >
      <ul className="divide-y divide-ink/[0.08] overflow-hidden rounded-3xl border border-ink/[0.08] bg-white shadow-card">
        {rows.map((r) => (
          <li
            key={r.title}
            className="grid gap-x-8 gap-y-3 p-6 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center md:px-8 md:py-7"
          >
            <span className="num font-display text-[44px] font-bold leading-none tracking-tight text-primary">
              {r.value}
            </span>
            <span>
              <span className="block text-[17px] font-semibold">{r.title}</span>
              <span className="mt-1 block text-[15px] leading-6 text-muted">{r.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">Card processing fees from Stripe may apply.</p>
    </SectionShell>
  );
}

/* ------------------------------------------------------------- advertise */

const CHANNELS = [
  "Autotrader",
  "Cars.com",
  "CarGurus",
  "Edmunds",
  "OfferUp",
  "Facebook Marketplace",
  "Craigslist",
  "eBay Motors",
  "PrivateAuto",
];

const initials = (name: string) =>
  name
    .replace(/\.com$/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function ChannelTile({ name, children }: { name: string; children: ReactNode }) {
  return (
    <li className="flex h-[68px] items-center gap-2.5 rounded-2xl border border-ink/[0.08] bg-white px-3 shadow-card sm:gap-3 sm:px-4">
      <span aria-hidden className={cn(ICON_TILE, "h-9 w-9 font-display text-sm font-bold")}>
        {children}
      </span>
      <span className="min-w-0 text-sm font-semibold leading-5 sm:text-[15px]">{name}</span>
    </li>
  );
}

function Advertise() {
  return (
    <SectionShell
      tone="surface"
      eyebrow="Advertise everywhere"
      title="Post once, reach buyers on the sites they already use."
      lead="Your listing goes out to popular car sites, or you share your own link."
      layout="center"
    >
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {CHANNELS.map((c) => (
          <ChannelTile key={c} name={c}>
            {initials(c)}
          </ChannelTile>
        ))}
        <ChannelTile name="Your own link">
          <Link2 aria-hidden className="h-4 w-4" />
        </ChannelTile>
      </ul>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------- faq */

const FAQS = [
  {
    id: "bank",
    title: "What does “be the bank” mean?",
    body: "You sell your car for a price you set, and your buyer pays you back in monthly payments with interest. You stay on the title until the last payment.",
  },
  {
    id: "fee",
    title: "Who pays OwnerFi, and how much?",
    body: "The seller pays 10% of the down payment, taken automatically when the buyer pays it in the app. Buyers pay no OwnerFi fees, and monthly payments have no OwnerFi cut.",
  },
  {
    id: "late",
    title: "What if the buyer stops paying?",
    body: "We send reminders and show you your options step by step. Because you hold the lien, you stay in control of the title.",
  },
  {
    id: "title",
    title: "Do I keep the title?",
    body: "Yes. You are listed on the title as lienholder until the car is paid off. Then we guide you through releasing the lien.",
  },
  {
    id: "buyers",
    title: "How do you check buyers?",
    body: "Every buyer verifies their ID, connects a bank account and agrees to a soft credit check. You see a simple risk profile before you decide.",
  },
  {
    id: "states",
    title: "What states are supported?",
    body: "Rules vary by state, including the highest interest rate you can charge and how many cars you can sell a year. We show the limits for your state as you go.",
  },
  {
    id: "demo",
    title: "Is this a real product?",
    body: "This is a demo. No real money moves and no real ID or credit checks happen.",
  },
];

function Faq() {
  return (
    <SectionShell
      id="faq"
      eyebrow="FAQ"
      title="Questions"
      lead="The short answers. Every screen in the app explains the next step as you go."
      layout="side"
      aside={
        <AppLink to="/#calculator" className="inline-flex items-center gap-1.5 rounded-lg font-semibold text-primary hover:underline">
          See what you’d earn <ArrowRight aria-hidden className="h-4 w-4" />
        </AppLink>
      }
    >
      <Accordion
        className="shadow-card"
        defaultOpenId="bank"
        items={FAQS.map((f) => ({ id: f.id, title: f.title, content: f.body }))}
      />
    </SectionShell>
  );
}

/* ---------------------------------------------------------------- beta */

function BetaCta() {
  return (
    <section aria-labelledby="beta-cta-title" className="bg-white">
      <div className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-ink bg-brand-glow px-6 py-14 text-center text-white md:px-12 md:py-20">
          <p className="eyebrow text-sky">We’re in beta</p>
          <h2
            id="beta-cta-title"
            className="mx-auto mt-4 max-w-2xl text-[32px] font-bold leading-[1.1] md:text-[48px]"
          >
            Join the founding sellers
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-white/70">
            Be one of the first to sell on OwnerFi. Listing your car is free.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink
              to="/auth/signup"
              variant="accent"
              size="lg"
              rightIcon={<ArrowRight aria-hidden className="h-5 w-5" />}
            >
              Create your account
            </ButtonLink>
            <ButtonLink to="/cars" variant="ghost" size="lg" className={GHOST_ON_DARK}>
              Browse cars
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ page */

function Landing() {
  const hash = useLocation({ select: (l) => l.hash });
  useEffect(() => {
    if (hash) document.getElementById(hash.replace(/^#/, ""))?.scrollIntoView();
  }, [hash]);

  return (
    <SiteLayout>
      <Hero />
      <HowItWorks />
      <Calculator />
      <Protections />
      <Audience />
      <Pricing />
      <Advertise />
      <Faq />
      <BetaCta />
    </SiteLayout>
  );
}
