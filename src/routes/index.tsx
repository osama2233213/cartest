import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BadgeCheck, Car, FileSignature, Handshake, KeyRound, Landmark, SearchCheck, ShieldCheck, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { dealTerms, fmtUsd } from "@/lib/finance";
import hero from "@/assets/hero-handoff.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OwnerFi — Sell your car. Be the bank." },
      { name: "description", content: "Sell your car on monthly payments to a verified buyer. Set your price, down payment and rate, keep the title until it's paid off, and earn interest." },
      { property: "og:title", content: "OwnerFi — Sell your car. Be the bank." },
      { property: "og:description", content: "Seller-financed private car sales with verified buyers, inspections and contracts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: BadgeCheck, t: "Verify yourself", d: "Identity and payout account, once." },
  { icon: SearchCheck, t: "Check the car", d: "Title, lien, theft and history from the VIN." },
  { icon: Landmark, t: "Set your terms", d: "Price, down payment and rate — capped at your state's legal max." },
  { icon: Car, t: "Advertise", d: "Share a tracked link on the marketplaces you already use." },
  { icon: Handshake, t: "Pick a buyer", d: "Verified buyers apply. You see a risk profile and decide." },
  { icon: Wrench, t: "Mobile inspection", d: "A mechanic inspects the car before anyone signs." },
  { icon: FileSignature, t: "Sign & collect", d: "State-ready contract, then the down payment lands with you." },
  { icon: KeyRound, t: "Get paid monthly", d: "You stay on the title until it's paid off." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="hero-glow">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="size-3.5" /> OwnerFi never holds your money
            </span>
            <h1 className="text-5xl font-bold leading-[1.05] text-ink md:text-6xl">
              Sell your car.
              <br />
              <span className="text-primary">Be the bank.</span>
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Sell to a verified buyer on monthly payments. You set the price, the down payment and
              the rate — and earn the interest a dealer would.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <a href="#earn">See what you'd earn</a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/cars">Browse cars by monthly payment</Link>
              </Button>
            </div>
          </div>
          <img
            src={hero}
            alt="A seller handing car keys to a buyer"
            width={1280}
            height={960}
            className="aspect-[4/3] w-full rounded-[20px] object-cover shadow-xl"
          />
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold text-ink">How it works</h2>
        <p className="mt-2 text-muted-foreground">Eight steps, one shared deal room, always one clear next step.</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.t} className="card-surface p-5">
              <div className="flex items-center justify-between">
                <s.icon className="size-6 text-primary" />
                <span className="money text-xs font-semibold text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold text-ink">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <EarningsCalculator />

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold text-ink">Protections built in</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Verified on both sides", "Sellers verify identity and payouts. Buyers verify identity, bank and give soft-credit consent."],
            ["Checked before listing", "Every VIN is checked for liens, theft and branded titles before it can go live."],
            ["You stay on the title", "The title moves to the buyer with you as lienholder until the last payment."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-surface p-6">
              <ShieldCheck className="size-6 text-success" />
              <h3 className="mt-3 font-semibold text-ink">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="fees" className="mx-auto max-w-6xl px-4 py-20">
        <div className="rounded-[20px] bg-ink p-8 text-primary-foreground md:p-12">
          <h2 className="text-3xl font-bold">One simple fee</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Fee big="10%" t="of the down payment" d="Paid by the seller, taken automatically when the down payment is made." />
            <Fee big="$0" t="on monthly payments" d="Monthly payments go straight from buyer to seller." />
            <Fee big="$0" t="for buyers" d="Buyers pay no OwnerFi fees. The mobile inspection is booked at cost." />
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-3xl font-bold text-ink">Questions</h2>
        <Accordion type="single" collapsible className="mt-6">
          {([
            ["Is OwnerFi a lender?", "No. OwnerFi is software. The seller finances the sale and makes every credit decision. We never hold funds."],
            ["How is the interest rate set?", "The seller picks it, and we cap it at the legal maximum for the seller's state."],
            ["What if the buyer stops paying?", "You get reminders at day 1, 5, 15 and 30, and our team opens a case with you. We never repossess cars."],
            ["What if the deal falls apart before the title moves?", "The buyer's down payment is fully refunded, including the fee."],
          ] as [string, string][]).map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="text-left">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      <SiteFooter />
    </div>
  );
}

function Fee({ big, t, d }: { big: string; t: string; d: string }) {
  return (
    <div>
      <p className="money text-5xl font-bold">{big}</p>
      <p className="mt-1 font-semibold">{t}</p>
      <p className="mt-2 text-sm opacity-70">{d}</p>
    </div>
  );
}

function EarningsCalculator() {
  const [price, setPrice] = useState(22000);
  const [down, setDown] = useState(15);
  const [apr, setApr] = useState(10);
  const [term, setTerm] = useState(48);
  const t = useMemo(
    () => dealTerms({ priceCents: price * 100, downPct: down, apr, termMonths: term }),
    [price, down, apr, term],
  );
  return (
    <section id="earn" className="bg-surface py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-ink">What you'd earn</h2>
          <Ctl label="Asking price" value={fmtUsd(price * 100)}>
            <Slider value={[price]} min={5000} max={60000} step={500} onValueChange={(v) => setPrice(v[0] ?? 0)} aria-label="Asking price" />
          </Ctl>
          <Ctl label="Down payment" value={`${down}%`}>
            <Slider value={[down]} min={10} max={30} step={1} onValueChange={(v) => setDown(v[0] ?? 0)} aria-label="Down payment" />
          </Ctl>
          <Ctl label="Interest rate" value={`${apr}% APR`}>
            <Slider value={[apr]} min={0} max={18} step={0.5} onValueChange={(v) => setApr(v[0] ?? 0)} aria-label="Interest rate" />
          </Ctl>
          <p className="text-xs text-muted-foreground">Your rate is capped at your state's legal max (e.g. AZ 10%, TX 18%).</p>
          <div className="flex gap-2">
            {[24, 36, 48, 60].map((m) => (
              <button key={m} onClick={() => setTerm(m)} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${m === term ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
                {m} mo
              </button>
            ))}
          </div>
        </div>
        <div className="card-surface self-start p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Total you receive</p>
          <p className="money text-5xl font-bold text-primary">{fmtUsd(t.sellerTotal)}</p>
          <p className="mt-1 text-sm text-success font-medium">
            {fmtUsd(t.interest)} more than selling for cash
          </p>
          <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
            {[
              ["Down payment from buyer", fmtUsd(t.down)],
              ["OwnerFi fee (10% of down)", `−${fmtUsd(t.fee)}`],
              ["You get at closing", fmtUsd(t.sellerNet)],
              ["Monthly payment to you", fmtUsd(t.monthly, { cents: true })],
              ["Interest you earn", fmtUsd(t.interest)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="money font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Ctl({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="money font-semibold text-ink">{value}</span>
      </div>
      {children}
    </div>
  );
}
