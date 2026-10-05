import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BadgeCheck, MapPin } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { CarPhoto } from "@/components/site/CarPhoto";
import { Slider } from "@/components/ui/slider";
import { listPublicVehicles, type PublicVehicle } from "@/lib/vehicles.functions";
import { useDemoStore } from "@/lib/demo-store";
import { dealTerms, fmtUsd } from "@/lib/finance";

const carsQuery = queryOptions({ queryKey: ["public-vehicles"], queryFn: () => listPublicVehicles() });

export const Route = createFileRoute("/cars/")({
  head: () => ({
    meta: [
      { title: "Browse cars by monthly payment — OwnerFi" },
      { name: "description", content: "Find a verified private-seller car you can pay off monthly, with no bank or dealer." },
      { property: "og:title", content: "Browse cars by monthly payment — OwnerFi" },
      { property: "og:description", content: "Verified private-seller cars with seller financing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(carsQuery),
  component: CarsPage,
  errorComponent: () => <p className="p-10 text-center">Couldn't load cars. Try again.</p>,
  notFoundComponent: () => <p className="p-10 text-center">Not found.</p>,
});

const est = (v: PublicVehicle) =>
  dealTerms({
    priceCents: v.price_cents,
    downPct: Number(v.min_down_pct),
    apr: Number(v.apr),
    termMonths: Math.max(...v.allowed_terms),
  }).monthly;

function CarsPage() {
  const { data } = useSuspenseQuery(carsQuery);
  const { allVehicles } = useDemoStore();
  const [maxMonthly, setMaxMonthly] = useState(800);
  const [state, setState] = useState("all");
  const [body, setBody] = useState("all");
  const [sort, setSort] = useState<"payment" | "price" | "newest">("payment");

  const combinedVehicles = useMemo(() => allVehicles(data.vehicles), [allVehicles, data.vehicles]);

  const cars = useMemo(() => {
    const list = combinedVehicles
      .map((v) => ({ v, monthly: est(v) }))
      .filter((x) => x.monthly <= maxMonthly * 100)
      .filter((x) => state === "all" || x.v.state === state)
      .filter((x) => body === "all" || x.v.body === body);
    if (sort === "payment") list.sort((a, b) => a.monthly - b.monthly);
    if (sort === "price") list.sort((a, b) => a.v.price_cents - b.v.price_cents);
    if (sort === "newest") list.sort((a, b) => new Date(b.v.created_at).getTime() - new Date(a.v.created_at).getTime());
    return list;
  }, [combinedVehicles, maxMonthly, state, body, sort]);

  const states = [...new Set(combinedVehicles.map((v) => v.state))].sort();
  const bodies = [...new Set(combinedVehicles.map((v) => v.body).filter(Boolean))] as string[];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold text-ink">Cars you can pay monthly</h1>
        <p className="mt-1 text-muted-foreground">Every seller is verified. Every car is VIN-checked.</p>

        <div className="mt-6 grid gap-4 rounded-2xl bg-surface p-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Monthly payment up to</span>
              <span className="money font-semibold">{fmtUsd(maxMonthly * 100)}</span>
            </div>
            <Slider value={[maxMonthly]} min={150} max={1200} step={25} onValueChange={(v) => setMaxMonthly(v[0] ?? 0)} aria-label="Max monthly payment" />
          </div>
          <Select label="State" value={state} onChange={setState} options={["all", ...states]} />
          <div className="grid grid-cols-2 gap-2">
            <Select label="Body" value={body} onChange={setBody} options={["all", ...bodies]} />
            <Select label="Sort" value={sort} onChange={(v) => setSort(v as typeof sort)} options={["payment", "price", "newest"]} labels={{ payment: "Lowest payment", price: "Lowest price", newest: "Newest" }} />
          </div>
        </div>

        {data.error && <p className="mt-6 rounded-xl bg-danger/10 p-4 text-sm text-danger">{data.error}</p>}
        {cars.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="font-semibold text-ink">No cars match yet</p>
            <p className="text-sm text-muted-foreground">Try raising your monthly budget or clearing filters.</p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cars.map(({ v, monthly }) => (
              <li key={v.id}>
                <Link to="/cars/$id" params={{ id: v.id }} className="group block overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-lg">
                  <div className="relative">
                    <CarPhoto src={v.photos[0]} alt={`${v.year} ${v.make} ${v.model}`} className="aspect-[4/3] w-full" />
                    {v.status === "reserved" && (
                      <span className="absolute left-3 top-3 rounded-full bg-warning px-2.5 py-1 text-xs font-semibold text-primary-foreground">Reserved</span>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <h2 className="font-semibold text-ink">{v.year} {v.make} {v.model} <span className="font-normal text-muted-foreground">{v.trim}</span></h2>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {v.city}, {v.state} · {v.mileage.toLocaleString()} mi
                    </p>
                    <div className="flex items-end justify-between pt-1">
                      <div>
                        <p className="money text-2xl font-bold text-primary">{fmtUsd(monthly)}<span className="text-sm font-medium text-muted-foreground">/mo</span></p>
                        <p className="money text-xs text-muted-foreground">{fmtUsd(v.price_cents)} · {v.apr}% APR · {v.min_down_pct}% down</p>
                      </div>
                      {v.seller_verified && (
                        <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
                          <BadgeCheck className="size-3.5" /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Select({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3">
        {options.map((o) => (
          <option key={o} value={o}>{labels?.[o] ?? (o === "all" ? "Any" : o)}</option>
        ))}
      </select>
    </label>
  );
}
