import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Car as CarIcon, Search } from "lucide-react";
import { useMemo } from "react";
import { Badge, Button, EmptyState, NativeSelect, TextInput } from "@/components/kit";
import { AdminHeader, AdminPage, DataTable, FilterBar, anySearch, pageOf, useSortParam, useUrlParams } from "@/components/admin/kit";
import { CarImage } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { checkSummary, dateShort, vehicleGroup, vehicleName, useAdminModel, type AdminVehicle } from "@/lib/admin-data";
import { moneyC } from "@/lib/format";

export const Route = createFileRoute("/admin/vehicles/")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Vehicles · Admin · OwnerFi" }] }),
  component: VehiclesPage,
});

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "listed", label: "Listed" },
  { value: "review", label: "In review" },
  { value: "sold", label: "Sold" },
  { value: "not_listed", label: "Not listed" },
  { value: "blocked", label: "Blocked" },
];
const SIZE = 12;

function VehiclesPage() {
  const m = useAdminModel();
  const navigate = useNavigate();
  const { params, set, clear } = useUrlParams();
  const sort = useSortParam("-listed", ["listed", "price"]);
  const status = STATUSES.find((s) => s.value === params.get("status"))?.value ?? "all";
  const flag = params.get("flag") === "flagged" ? "flagged" : "all";
  const state = params.get("state") ?? "";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const states = useMemo(() => [...new Set(m.vehicles.map((v) => v.state))].sort(), [m.vehicles]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return m.vehicles
      .filter((v) => status === "all" || vehicleGroup(v) === status)
      .filter((v) => flag === "all" || v.flagged)
      .filter((v) => !state || v.state === state)
      .filter((v) => !needle || `${v.vin} ${v.make} ${v.model} ${v.year} ${v.sellerName}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const d = sort.sortKey === "price" ? a.asking - b.asking : a.listedAt.localeCompare(b.listedAt);
        return sort.sortDir === "asc" ? d : -d;
      });
  }, [m.vehicles, status, flag, state, q, sort.sortKey, sort.sortDir]);
  const filtering = status !== "all" || flag !== "all" || state !== "" || q !== "";

  return (
    <AdminPage>
      <AdminHeader title="Vehicles" description="Every car on OwnerFi." />
      <FilterBar>
        <TextInput label="Search" placeholder="VIN, make, model or seller" wrapperClassName="w-full sm:w-72" leftAdornment={<Search aria-hidden className="h-4 w-4" />} value={q} onChange={(e) => set({ q: e.target.value })} />
        <NativeSelect label="Status" className="sm:w-44" value={status} onChange={(e) => set({ status: e.target.value === "all" ? null : e.target.value })} options={STATUSES} />
        <NativeSelect label="Flag" className="sm:w-40" value={flag} onChange={(e) => set({ flag: e.target.value === "all" ? null : e.target.value })} options={[{ value: "all", label: "Any" }, { value: "flagged", label: "Flagged only" }]} />
        <NativeSelect label="State" className="sm:w-40" value={state} onChange={(e) => set({ state: e.target.value })} options={[{ value: "", label: "All states" }, ...states.map((s) => ({ value: s, label: s }))]} />
      </FilterBar>
      <DataTable<AdminVehicle>
        caption="Vehicles"
        rows={pageOf(rows, page, SIZE)}
        total={rows.length}
        page={page}
        pageSize={SIZE}
        onPageChange={(p) => set({ page: String(p) })}
        getRowId={(v) => v.id}
        sortKey={sort.sortKey}
        sortDir={sort.sortDir}
        onSort={sort.onSort}
        columns={[
          {
            key: "car",
            header: "Car",
            render: (v) => (
              <button type="button" onClick={() => navigate({ to: "/admin/vehicles/$id", params: { id: v.id } })} className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <CarImage src={v.photos[0]} alt="" make={v.make} model={v.model} className="h-10 w-14 shrink-0 rounded-lg" />
                <span>
                  <span className="block font-semibold text-ink">{vehicleName(v)}</span>
                  <span className="block text-muted">VIN …{v.vin.slice(-6)}</span>
                </span>
              </button>
            ),
          },
          { key: "seller", header: "Seller", render: (v) => v.sellerName },
          { key: "price", header: "Price", sortable: true, align: "right", render: (v) => moneyC(v.asking) },
          { key: "status", header: "Status", render: (v) => <StatusChip kind="vehicle" value={v.status} /> },
          { key: "checks", header: "Checks", render: (v) => <Badge tone={checkSummary(v).tone}>{checkSummary(v).label}</Badge> },
          { key: "flag", header: "Flag", render: (v) => (v.flagged ? <Badge tone="danger">Flagged</Badge> : "—") },
          { key: "ads", header: "Ads", align: "right", render: (v) => v.liveAds },
          { key: "listed", header: "Listed", sortable: true, render: (v) => dateShort(v.listedAt) },
        ]}
        emptyState={
          <EmptyState icon={<CarIcon aria-hidden className="h-6 w-6" />} title="No cars match" description="Try a different search or filter." action={filtering ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} />
        }
      />
    </AdminPage>
  );
}
