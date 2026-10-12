import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  NativeSelect,
  PageHeader,
  Sheet,
  Skeleton,
  Slider,
  TextInput,
  useToast,
} from "@/components/kit";
import { SiteLayout } from "@/components/site/SiteChrome";
import { BODY_TYPES, CAR_GRID, STICKY_TOP, CarCard, bodyLabel, carEstimate } from "@/components/site/cars";
import { useDemoStore } from "@/lib/demo-store";
import { money } from "@/lib/format";
import { CITY_OPTIONS, defaultCityForState, distanceMiles, locate, locateLabel, type Point } from "@/lib/geo";
import { useSaved } from "@/lib/saved";
import { useCurrentUser } from "@/lib/session";
import { listPublicVehicles, type PublicVehicle } from "@/lib/vehicles.functions";
import { cn } from "@/lib/utils";

const carsQuery = queryOptions({ queryKey: ["public-vehicles"], queryFn: () => listPublicVehicles(), staleTime: 60_000 });

const MAX_PRICE = 60_000;
const MAX_MONTHLY = 1_000;
const PAGE_SIZE = 12;
const DISTANCES = [25, 50, 100, 250, 500];

type Sort = "newest" | "monthly_asc" | "price_asc" | "price_desc" | "mileage";
const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "monthly_asc", label: "Lowest monthly payment" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "mileage", label: "Lowest mileage" },
];

type Params = {
  q: string;
  make: string;
  model: string;
  body: string;
  maxPrice: number;
  maxMonthly: number;
  maxMiles: number;
  minYear: number;
  /** Miles from `near`. 0 means any distance. */
  maxDist: number;
  /** "City, ST" the distance is measured from. Empty means the buyer's own state. */
  near: string;
  sort: Sort;
  page: number;
};

const DEFAULTS: Params = {
  q: "",
  make: "",
  model: "",
  maxDist: 0,
  near: "",
  body: "",
  maxPrice: MAX_PRICE,
  maxMonthly: MAX_MONTHLY,
  maxMiles: 0,
  minYear: 0,
  sort: "newest",
  page: 1,
};

const num = (v: unknown, d: number) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);

export const Route = createFileRoute("/cars/")({
  validateSearch: (s: Record<string, unknown>): Partial<Record<keyof Params, string | number>> => {
    const out: Partial<Record<keyof Params, string | number>> = {};
    for (const k of Object.keys(DEFAULTS) as (keyof Params)[]) {
      const v = s[k];
      if (v === undefined || v === "") continue;
      out[k] = typeof DEFAULTS[k] === "number" ? num(v, DEFAULTS[k] as number) : String(v);
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Find a car · OwnerFi" },
      { name: "description", content: "Find a verified private-seller car you can pay off monthly, with no bank or dealer." },
      { property: "og:title", content: "Find a car · OwnerFi" },
      { property: "og:type", content: "website" },
    ],
  }),
  // On the server, wait for the cars so the page arrives complete. In the browser, start loading and show the page
  // right away with placeholders, instead of freezing on the old screen until the data is back.
  loader: ({ context }) => {
    const cars = context.queryClient.ensureQueryData(carsQuery);
    if (typeof window === "undefined") return cars;
    cars.catch(() => undefined);
    return undefined;
  },
  component: CarsPage,
  errorComponent: () => <p className="p-10 text-center">Couldn't load cars. Try again.</p>,
  notFoundComponent: () => <p className="p-10 text-center">Not found.</p>,
});

function useParams(): { params: Params; update: (p: Partial<Params>) => void; clear: () => void; activeCount: number } {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const params = useMemo<Params>(
    () => ({
      q: String(search.q ?? DEFAULTS.q),
      make: String(search.make ?? DEFAULTS.make),
      model: String(search.model ?? DEFAULTS.model),
      maxDist: num(search.maxDist, DEFAULTS.maxDist),
      near: String(search.near ?? DEFAULTS.near),
      body: String(search.body ?? DEFAULTS.body),
      maxPrice: num(search.maxPrice, DEFAULTS.maxPrice),
      maxMonthly: num(search.maxMonthly, DEFAULTS.maxMonthly),
      maxMiles: num(search.maxMiles, DEFAULTS.maxMiles),
      minYear: num(search.minYear, DEFAULTS.minYear),
      sort: (SORTS.some((s) => s.value === search.sort) ? search.sort : DEFAULTS.sort) as Sort,
      page: num(search.page, DEFAULTS.page),
    }),
    [search],
  );

  const update = (patch: Partial<Params>) => {
    const merged: Params = { ...params, page: 1, ...patch };
    const next: Record<string, string | number> = {};
    for (const k of Object.keys(DEFAULTS) as (keyof Params)[]) {
      if (merged[k] !== DEFAULTS[k]) next[k] = merged[k];
    }
    navigate({ to: "/cars", search: next as never, replace: true });
  };
  const clear = () => navigate({ to: "/cars", search: {} as never, replace: true });
  const activeCount = [
    params.make,
    params.model,
    params.maxDist,
    params.body,
    params.maxPrice < MAX_PRICE,
    params.maxMonthly < MAX_MONTHLY,
    params.maxMiles,
    params.minYear,
  ].filter(Boolean).length;
  return { params, update, clear, activeCount };
}

/* ---------------------------------------------------------------- filters */

function FilterGroup({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      {title && <p className="text-sm font-semibold text-ink">{title}</p>}
      {children}
      {hint && <p className="mt-1 text-xs leading-5 text-muted">{hint}</p>}
    </div>
  );
}

function FilterPanel({
  params,
  makes,
  models,
  homeCity,
  onChange,
}: {
  params: Params;
  makes: string[];
  models: string[];
  homeCity: string;
  onChange: (p: Partial<Params>) => void;
}) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => thisYear - i);
  return (
    <div className="divide-y divide-ink/[0.08]">
      <FilterGroup title="Monthly payment up to" hint="Based on the seller’s smallest down payment and longest term.">
        <Slider
          label="Monthly payment up to"
          min={100}
          max={MAX_MONTHLY}
          step={25}
          value={Math.max(100, params.maxMonthly)}
          onChange={(v) => onChange({ maxMonthly: v })}
          formatValue={(v) => (v >= MAX_MONTHLY ? "Any" : money(v))}
          className="px-2"
        />
      </FilterGroup>
      <FilterGroup title="Price up to">
        <Slider
          label="Price up to"
          min={5_000}
          max={MAX_PRICE}
          step={1_000}
          value={Math.max(5_000, params.maxPrice)}
          onChange={(v) => onChange({ maxPrice: v })}
          formatValue={(v) => (v >= MAX_PRICE ? "Any" : money(v))}
          className="px-2"
        />
      </FilterGroup>
      <FilterGroup>
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Body type</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {BODY_TYPES.map((b) => {
              const on = params.body === b;
              return (
                <Chip key={b} selected={on} onClick={() => onChange({ body: on ? "" : b })}>
                  {bodyLabel(b)}
                </Chip>
              );
            })}
          </div>
        </fieldset>
      </FilterGroup>
      <FilterGroup>
        <NativeSelect
          size="sm"
          label="Make"
          value={params.make}
          onChange={(e) => onChange({ make: e.target.value, model: "" })}
          options={[{ value: "", label: "Any make" }, ...makes.map((m) => ({ value: m, label: m }))]}
        />
        <div className="mt-4">
          <NativeSelect
            size="sm"
            label="Model"
            value={params.model}
            onChange={(e) => onChange({ model: e.target.value })}
            options={[{ value: "", label: "Any model" }, ...models.map((m) => ({ value: m, label: m }))]}
          />
        </div>
      </FilterGroup>
      <FilterGroup title="Distance" hint="Straight-line miles from the city you pick.">
        <div className="mt-3 space-y-4">
          <NativeSelect
            size="sm"
            label="Within"
            value={String(params.maxDist)}
            onChange={(e) => onChange({ maxDist: Number(e.target.value) })}
            options={[{ value: "0", label: "Any distance" }, ...DISTANCES.map((d) => ({ value: String(d), label: `${d} miles` }))]}
          />
          <NativeSelect
            size="sm"
            label="Of"
            value={params.near || homeCity}
            onChange={(e) => onChange({ near: e.target.value })}
            options={CITY_OPTIONS.map((c) => ({ value: c, label: c }))}
          />
        </div>
      </FilterGroup>
      <FilterGroup>
        <div className="space-y-4">
          <NativeSelect
            size="sm"
            label="Year"
            value={String(params.minYear)}
            onChange={(e) => onChange({ minYear: Number(e.target.value) })}
            options={[{ value: "0", label: "Any year" }, ...years.map((y) => ({ value: String(y), label: `${y} or newer` }))]}
          />
          <NativeSelect
            size="sm"
            label="Mileage"
            value={String(params.maxMiles)}
            onChange={(e) => onChange({ maxMiles: Number(e.target.value) })}
            options={[
              { value: "0", label: "Any mileage" },
              ...[25_000, 50_000, 75_000, 100_000].map((m) => ({ value: String(m), label: `Under ${m.toLocaleString("en-US")} mi` })),
            ]}
          />
        </div>
      </FilterGroup>
    </div>
  );
}

function ActiveFilters({
  params,
  homeCity,
  onChange,
  onClear,
}: {
  params: Params;
  homeCity: string;
  onChange: (p: Partial<Params>) => void;
  onClear: () => void;
}) {
  const items: { label: string; reset: Partial<Params> }[] = [];
  if (params.maxMonthly < MAX_MONTHLY) items.push({ label: `Up to ${money(params.maxMonthly)}/mo`, reset: { maxMonthly: MAX_MONTHLY } });
  if (params.maxPrice < MAX_PRICE) items.push({ label: `Up to ${money(params.maxPrice)}`, reset: { maxPrice: MAX_PRICE } });
  if (params.body) items.push({ label: bodyLabel(params.body), reset: { body: "" } });
  if (params.make) items.push({ label: params.make, reset: { make: "", model: "" } });
  if (params.model) items.push({ label: params.model, reset: { model: "" } });
  if (params.maxDist) items.push({ label: `Within ${params.maxDist} mi of ${params.near || homeCity}`, reset: { maxDist: 0, near: "" } });
  if (params.minYear) items.push({ label: `${params.minYear} or newer`, reset: { minYear: 0 } });
  if (params.maxMiles) items.push({ label: `Under ${params.maxMiles.toLocaleString("en-US")} mi`, reset: { maxMiles: 0 } });
  if (!items.length) return null;
  return (
    <ul aria-label="Filters on" className="flex flex-wrap items-center gap-2">
      {items.map((f) => (
        <li key={f.label}>
          <Chip
            selected
            aria-pressed={undefined}
            aria-label={`Remove filter ${f.label}`}
            onClick={() => onChange(f.reset)}
            className="num pr-2 hover:border-primary/50 hover:bg-primary-100"
          >
            {f.label}
            <X aria-hidden className="h-3.5 w-3.5" />
          </Chip>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={onClear}
          className="h-8 rounded-full px-2 text-sm font-semibold text-muted hover:text-ink hover:underline"
        >
          Clear all
        </button>
      </li>
    </ul>
  );
}

/* ------------------------------------------------------------------ page */

function matches(v: PublicVehicle, p: Params, origin: Point | null) {
  const { monthly } = carEstimate(v);
  const q = p.q.trim().toLowerCase();
  if (q && ![v.make, v.model, v.trim ?? "", v.city, v.state, String(v.year)].join(" ").toLowerCase().includes(q)) return false;
  if (p.make && v.make !== p.make) return false;
  if (p.model && v.model !== p.model) return false;
  if (p.maxDist && origin) {
    const at = locate(v.city, v.state);
    if (!at || distanceMiles(origin, at) > p.maxDist) return false;
  }
  if (p.body && (v.body ?? "").toLowerCase() !== p.body) return false;
  if (p.maxPrice < MAX_PRICE && v.price_cents / 100 > p.maxPrice) return false;
  if (p.maxMonthly < MAX_MONTHLY && monthly > p.maxMonthly) return false;
  if (p.maxMiles && v.mileage > p.maxMiles) return false;
  if (p.minYear && v.year < p.minYear) return false;
  return true;
}

function sortCars(list: PublicVehicle[], sort: Sort) {
  const out = [...list];
  const t = (v: PublicVehicle) => new Date(v.created_at).getTime();
  if (sort === "newest") out.sort((a, b) => t(b) - t(a));
  if (sort === "monthly_asc") out.sort((a, b) => carEstimate(a).monthly - carEstimate(b).monthly);
  if (sort === "price_asc") out.sort((a, b) => a.price_cents - b.price_cents);
  if (sort === "price_desc") out.sort((a, b) => b.price_cents - a.price_cents);
  if (sort === "mileage") out.sort((a, b) => a.mileage - b.mileage);
  return out;
}

function CarsPage() {
  const { data, isPending } = useQuery(carsQuery);
  const { allVehicles } = useDemoStore();
  const { params, update, clear, activeCount } = useParams();
  // Typing in the search box shouldn't change the address (and re-run everything) on every key.
  const [qText, setQText] = useState(params.q);
  useEffect(() => setQText(params.q), [params.q]);
  useEffect(() => {
    if (qText === params.q) return;
    const t = window.setTimeout(() => update({ q: qText }), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qText]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const saved = useSaved();
  const toast = useToast();

  const listed = useMemo(() => allVehicles(data?.vehicles ?? []).filter((v) => v.status === "listed"), [allVehicles, data?.vehicles]);
  const makes = useMemo(() => [...new Set(listed.map((v) => v.make))].sort(), [listed]);
  // Models follow the chosen make, so the list never offers a model that can't match.
  const models = useMemo(() => [...new Set(listed.filter((v) => !params.make || v.make === params.make).map((v) => v.model))].sort(), [listed, params.make]);
  // Distance starts from the signed-in buyer's state, or Phoenix, until they pick a city.
  const user = useCurrentUser();
  const homeCity = defaultCityForState(user?.state);
  const origin = useMemo(() => (params.maxDist ? locateLabel(params.near || homeCity) : null), [params.maxDist, params.near, homeCity]);
  const results = useMemo(() => sortCars(listed.filter((v) => matches(v, params, origin)), params.sort), [listed, params, origin]);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(params.page, pages);
  const pageItems = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <SiteLayout>
      <div className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-6 md:pt-8 lg:px-8">
          <PageHeader
            eyebrow="Browse cars"
            title="Find a car you can pay for monthly"
            description="Every seller is verified. Every car is checked for liens and theft."
            action={
              <p className="hidden items-center gap-1.5 text-sm font-medium text-muted md:inline-flex">
                <ShieldCheck aria-hidden className="h-4 w-4 text-success" />
                OwnerFi never holds your money
              </p>
            }
          />
          <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside aria-label="Filters" className={cn("hidden lg:sticky lg:block", STICKY_TOP)}>
              <Card padding="none">
                <div className="flex h-14 items-center justify-between border-b border-ink/[0.08] px-5">
                  <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
                    <SlidersHorizontal aria-hidden className="h-4 w-4 text-muted" />
                    Filters
                    {activeCount > 0 && (
                      <span className="num rounded-full bg-primary-50 px-2 text-xs leading-5 text-primary-700">{activeCount}</span>
                    )}
                  </h2>
                  {activeCount > 0 && (
                    <button type="button" onClick={clear} className="text-sm font-semibold text-primary hover:underline">
                      Clear all
                    </button>
                  )}
                </div>
                <div className="p-5">
                  <FilterPanel params={params} makes={makes} models={models} homeCity={homeCity} onChange={update} />
                </div>
              </Card>
            </aside>

            <section aria-label="Cars for sale" className="min-w-0">
              <div className="mb-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <TextInput
                    aria-label="Search cars"
                    type="search"
                    placeholder="Search make, model or city"
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    leftAdornment={<Search aria-hidden className="h-4 w-4" />}
                    wrapperClassName="flex-1"
                    className="h-10 text-[15px] shadow-card"
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-10 flex-1 lg:hidden"
                      leftIcon={<SlidersHorizontal aria-hidden className="h-4 w-4" />}
                      onClick={() => setFiltersOpen(true)}
                    >
                      Filters
                      {activeCount > 0 && (
                        <span className="num rounded-full bg-primary px-1.5 text-xs leading-5 text-white">{activeCount}</span>
                      )}
                    </Button>
                    <div className="relative flex-1 sm:w-60 sm:flex-none">
                      <ArrowUpDown
                        aria-hidden
                        className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted"
                      />
                      <NativeSelect
                        size="sm"
                        aria-label="Sort by"
                        value={params.sort}
                        onChange={(e) => update({ sort: e.target.value as Sort })}
                        options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
                        className="pl-9 font-medium shadow-card"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <p aria-live="polite" className="shrink-0 text-sm text-muted">
                    <span className="num font-semibold text-ink">{results.length}</span>{" "}
                    {results.length === 1 ? "car" : "cars"}
                    {params.q ? (
                      <>
                        {" "}
                        for <span className="font-semibold text-ink">“{params.q}”</span>
                      </>
                    ) : (
                      " you can buy on monthly payments"
                    )}
                  </p>
                  <div className="md:ml-auto">
                    <ActiveFilters params={params} homeCity={homeCity} onChange={update} onClear={clear} />
                  </div>
                </div>
              </div>

              {isPending && listed.length === 0 ? (
                <ul aria-busy="true" aria-label="Loading cars" className={CAR_GRID}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <li key={i} className="overflow-hidden rounded-2xl border border-ink/[0.08] bg-white shadow-card">
                      <Skeleton className="aspect-[16/10] w-full rounded-none" />
                      <div className="space-y-3 p-4">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-6 w-1/3" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : results.length === 0 ? (
                <Card className="py-6">
                  <EmptyState
                    icon={<Search aria-hidden className="h-6 w-6" />}
                    title="No cars match yet"
                    description="Try a higher monthly payment or fewer filters."
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button onClick={clear}>Clear filters</Button>
                        <Button
                          variant="secondary"
                          onClick={() => toast({ tone: "success", title: "We’ll let you know", description: "Demo only. No email is sent." })}
                        >
                          Notify me when one does
                        </Button>
                      </div>
                    }
                  />
                </Card>
              ) : (
                <>
                  <h2 className="sr-only">Results</h2>
                  <ul className={CAR_GRID}>
                    {pageItems.map((v, i) => (
                      <li key={v.id} className="flex min-w-0 [&>*]:min-w-0 [&>*]:flex-1">
                        <CarCard
                          vehicle={v}
                          priority={i < 3}
                          saved={saved.isSaved(v.id)}
                          onToggleSave={saved.canSave ? () => saved.toggle(v.id) : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                  {pages > 1 && (
                    <nav aria-label="Pages" className="mt-8 flex items-center justify-center gap-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page <= 1}
                        leftIcon={<ChevronLeft aria-hidden className="h-4 w-4" />}
                        onClick={() => update({ page: page - 1 })}
                      >
                        Previous
                      </Button>
                      <span className="num text-sm text-muted">
                        Page <span className="font-semibold text-ink">{page}</span> of {pages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={page >= pages}
                        rightIcon={<ChevronRight aria-hidden className="h-4 w-4" />}
                        onClick={() => update({ page: page + 1 })}
                      >
                        Next
                      </Button>
                    </nav>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={clear}>
              Clear all
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show {results.length} cars
            </Button>
          </div>
        }
      >
        <FilterPanel params={params} makes={makes} models={models} homeCity={homeCity} onChange={update} />
      </Sheet>
    </SiteLayout>
  );
}
