import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Car as CarIcon, Eye, Heart, MessageSquare, Search } from "lucide-react";
import { AppLink, Button, ButtonLink, Chip, EmptyState, ErrorState, PageHeader, Skeleton, TextInput } from "@/components/kit";
import { CarImage, carTitle } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { carEstimate } from "@/components/site/cars";
import { money, miles, moneyC } from "@/lib/format";
import { useSellerVehicles, type VehicleStatus } from "@/lib/seller-data";

export const Route = createFileRoute("/seller/vehicles/")({
  head: () => ({ meta: [{ title: "My cars · OwnerFi" }] }),
  component: VehiclesPage,
});

type Filter = "all" | "listed" | "progress" | "sold" | "paused";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "listed", label: "Listed" },
  { value: "progress", label: "In progress" },
  { value: "sold", label: "Sold" },
  { value: "paused", label: "Not listed" },
];

const bucket = (s: VehicleStatus): Filter =>
  s === "listed" ? "listed" : s === "reserved" || s === "sold_active" || s === "paid_off" ? "sold" : s === "delisted" ? "paused" : "progress";

const NOTE: Record<VehicleStatus, (monthly: string) => string> = {
  draft: () => "Finish adding your car to publish it.",
  pending_review: () => "We’re checking the title. Usually done within 24 hours.",
  listed: (m) => `Buyers see it from ${m}/mo. Advertise to get more.`,
  reserved: () => "A buyer is in a deal on this car.",
  sold_active: () => "Sold. You’re collecting monthly payments.",
  paid_off: () => "Paid off. Time to release the lien.",
  delisted: () => "Hidden from buyers. Relist any time.",
};

function VehiclesPage() {
  const { vehicles, loading, error, reload } = useSellerVehicles();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, listed: 0, progress: 0, sold: 0, paused: 0 };
    for (const v of vehicles) {
      c.all += 1;
      c[bucket(v.status)] += 1;
    }
    return c;
  }, [vehicles]);

  const shown = vehicles.filter(
    (v) =>
      (filter === "all" || bucket(v.status) === filter) &&
      (!q.trim() || carTitle(v.vehicle).toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="My cars"
        description="Everything you’ve listed, and what each car needs next."
        action={<ButtonLink to="/seller/vehicles/new">Add a car</ButtonLink>}
      />
      {loading ? (
        <div aria-busy="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={<CarIcon aria-hidden className="h-6 w-6" />}
          title="No cars yet"
          description="Add your car and we’ll check it before it goes live."
          action={<ButtonLink to="/seller/vehicles/new">Add a car</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div role="group" aria-label="Filter cars" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Chip key={f.value} selected={filter === f.value} count={counts[f.value]} onClick={() => setFilter(f.value)}>
                  {f.label}
                </Chip>
              ))}
            </div>
            <TextInput
              aria-label="Search your cars"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search year, make or model"
              leftAdornment={<Search aria-hidden className="h-4 w-4" />}
              wrapperClassName="md:w-72"
              className="h-10 text-sm"
            />
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon={<Search aria-hidden className="h-6 w-6" />}
              title="Nothing here"
              description="No cars match. Try another filter or search."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFilter("all");
                    setQ("");
                  }}
                >
                  Show all
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map(({ vehicle: v, status, views, saves, questions }) => {
                const draft = status === "draft";
                const monthly = money(Math.round(carEstimate(v).monthly));
                return (
                  <li key={v.id}>
                    <AppLink
                      to={`/seller/vehicles/${v.id}`}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/[0.08] bg-white shadow-card transition-shadow duration-200 hover:border-ink/15 hover:shadow-raised"
                    >
                      <div className="relative overflow-hidden">
                        <CarImage
                          src={v.photos[0]}
                          alt={carTitle(v)}
                          make={v.make}
                          model={v.model}
                          aspect="16/10"
                          className="rounded-none transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        <span className="absolute left-3 top-3 rounded-full bg-white shadow-card">
                          <StatusChip kind="vehicle" value={status} />
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                        <h2 className="truncate font-sans text-[15px] font-semibold leading-5 tracking-normal">{carTitle(v)}</h2>
                        <p className="num mt-0.5 truncate text-[13px] text-muted">
                          {[v.trim, v.mileage ? miles(v.mileage) : ""].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <p className="num mt-3 flex items-baseline gap-2">
                          <span className="font-display text-xl font-bold tracking-tight">{moneyC(v.price_cents)}</span>
                          <span className="text-[13px] text-muted">≈ {monthly}/mo</span>
                        </p>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted">{NOTE[status](monthly)}</p>
                        <div aria-hidden className="min-h-3 flex-1" />
                        {draft ? (
                          <span className="inline-flex items-center gap-1 border-t border-ink/[0.06] pt-3 text-sm font-semibold text-primary">
                            Continue adding
                            <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        ) : (
                          <ul className="flex gap-4 border-t border-ink/[0.06] pt-3 text-xs text-muted">
                            {[
                              { Icon: Eye, n: views, label: "views" },
                              { Icon: Heart, n: saves, label: "saves" },
                              { Icon: MessageSquare, n: questions, label: "questions" },
                            ].map(({ Icon, n, label }) => (
                              <li key={label} className="num flex items-center gap-1.5">
                                <Icon aria-hidden className="h-3.5 w-3.5" />
                                {n} <span className="sr-only">{label}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </AppLink>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
