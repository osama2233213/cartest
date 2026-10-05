import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { AppShell, StatCard } from "@/components/app/AppShell";
import { DealList } from "@/components/app/DealList";
import { Button } from "@/components/ui/button";
import { useDemoStore } from "@/lib/demo-store";
import { PERSONAS, getNextAction, termsFor } from "@/lib/demo-data";
import { fmtUsd } from "@/lib/finance";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Seller dashboard (demo) — OwnerFi" },
      { name: "description", content: "Explore the OwnerFi seller experience: listings, deals and earnings." },
      { property: "og:title", content: "Seller dashboard (demo) — OwnerFi" },
      { property: "og:description", content: "Explore the OwnerFi seller experience." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SellerHome,
});

function SellerHome() {
  const { deals } = useDemoStore();
  const mine = deals.filter((d) => d.seller === PERSONAS.seller.name);
  const action = mine.filter((d) => getNextAction(d, "seller").who === "you");
  const earning = mine.reduce((s, d) => s + termsFor(d).sellerTotal, 0);
  return (
    <AppShell role="seller" nav={<><span className="text-ink">Dashboard</span><Link to="/cars">Marketplace</Link></>}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">Hi Maria</h1>
          <p className="text-muted-foreground">You're the bank. Here's what needs you today.</p>
        </div>
        <Button asChild>
          <Link to="/seller/vehicles/new">
            <Plus /> Add a car
          </Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard k="Active deals" v={String(mine.length)} />
        <StatCard k="Projected proceeds" v={fmtUsd(earning)} sub="Price + interest − fees" />
        <StatCard k="Sales this year" v="2 of 5" sub="Arizona annual limit" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 font-semibold text-ink">Action needed ({action.length})</h2>
          <DealList deals={action} role="seller" />
          <h2 className="mb-3 mt-8 font-semibold text-ink">All your deals</h2>
          <DealList deals={mine} role="seller" />
        </section>
        <aside className="card-surface h-fit p-5">
          <h2 className="font-semibold text-ink">Getting set up</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {[["Email verified", true], ["Identity verified", true], ["Payout account connected", true], ["First car listed", true]].map(([t, ok]) => (
              <li key={String(t)} className="flex items-center gap-2">
                {ok ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />} {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
