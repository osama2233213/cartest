import { createFileRoute, Link } from "@tanstack/react-router";
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

function BuyerHome() {
  const { deals } = useDemoStore();
  const mine = deals.filter((d) => d.buyer === PERSONAS.buyer.name);
  const active = mine.find((d) => d.stage === "active");
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
          v={active ? fmtUsd(termsFor(active).monthly, { cents: true }) : "—"}
          {...(active ? { sub: "Due Oct 5 · 2 days late" } : {})}
        />
        <StatCard k="Deals in progress" v={String(mine.length)} />
        <StatCard k="OwnerFi fees you pay" v="$0" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 font-semibold text-ink">Your deals</h2>
          <DealList deals={mine} role="buyer" />
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
