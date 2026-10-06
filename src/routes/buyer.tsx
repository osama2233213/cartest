import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Search } from "lucide-react";
import { AppShell, StatCard } from "@/components/app/AppShell";
import { DealList } from "@/components/app/DealList";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/lib/demo-store";
import { PERSONAS, termsFor } from "@/lib/demo-data";
import { fmtUsd } from "@/lib/finance";

export const Route = createFileRoute("/buyer")({
  head: () => ({
    meta: [
      { title: "Buyer dashboard (demo) — OwnerFi" },
      { name: "description", content: "Explore the OwnerFi buyer experience: verification, offers and payments." },
      { property: "og:title", content: "Buyer dashboard (demo) — OwnerFi" },
      { property: "og:description", content: "Explore the OwnerFi buyer experience." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuyerHome,
});

const ACTIVE_STAGES = new Set([
  "inquiry",
  "test_drive",
  "application",
  "negotiation",
  "inspection",
  "contract",
  "down_payment",
  "closing",
  "active",
]);

const CLOSED_STAGES = new Set([
  "paid_off",
  "declined",
  "cancelled",
  "defaulted",
]);

function BuyerHome() {
  const [tab, setTab] = useState<"active" | "closed">("active");
  const { deals } = useDemoStore();
  const mine = deals.filter((d) => d.buyer === PERSONAS.buyer.name);
  const activeDeals = mine.filter((d) => ACTIVE_STAGES.has(d.stage));
  const closedDeals = mine.filter((d) => CLOSED_STAGES.has(d.stage));
  const activeLoan = mine.find((d) => d.stage === "active");

  const displayedDeals = tab === "active" ? activeDeals : closedDeals;

  return (
    <AppShell role="buyer" nav={<><span className="text-ink">Dashboard</span><Link to="/cars">Find cars</Link></>}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">Hi Daniel</h1>
          <p className="text-muted-foreground">No bank, no dealer — just you and the seller.</p>
        </div>
        <Button asChild><Link to="/cars"><Search /> Browse by monthly payment</Link></Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          k="Next payment"
          v={activeLoan ? fmtUsd(termsFor(activeLoan).monthly, { cents: true }) : "—"}
          {...(activeLoan ? { sub: "Due Oct 5 · 2 days late" } : {})}
        />
        <StatCard k="Deals in progress" v={String(activeDeals.length)} />
        <StatCard k="OwnerFi fees you pay" v="$0" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-ink">Your deals</h2>
            <div className="flex rounded-xl bg-surface p-1 border border-border text-xs">
              <button
                type="button"
                onClick={() => setTab("active")}
                className={`rounded-lg px-3 py-1 font-semibold transition-all ${
                  tab === "active"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-ink"
                }`}
              >
                Active ({activeDeals.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("closed")}
                className={`rounded-lg px-3 py-1 font-semibold transition-all ${
                  tab === "closed"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-ink"
                }`}
              >
                Closed ({closedDeals.length})
              </button>
            </div>
          </div>
          {displayedDeals.length > 0 ? (
            <DealList deals={displayedDeals} role="buyer" />
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              {tab === "active"
                ? "No active deals right now. Browse marketplace cars to submit an offer."
                : "No closed or cancelled deals on record."}
            </div>
          )}
        </section>
        <aside className="card-surface h-fit p-5">
          <h2 className="font-semibold text-ink">You're verified</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sellers see your badges and a risk summary — never your raw credit report or ID.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {["Email", "Phone", "Identity", "Bank account", "Soft-credit consent"].map((t) => (
              <li key={t} className="flex items-center gap-2"><BadgeCheck className="size-4 text-success" /> {t}</li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
