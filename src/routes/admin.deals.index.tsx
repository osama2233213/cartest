import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Handshake, Search } from "lucide-react";
import { useMemo } from "react";
import { AppLink, Badge, Button, Card, EmptyState, NativeSelect, Segmented, TextInput } from "@/components/kit";
import { AdminHeader, AdminPage, DataTable, FilterBar, anySearch, pageOf, useSortParam, useUrlParams } from "@/components/admin/kit";
import { CarImage } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { isClosedStage, useAdminModel, type DealRow } from "@/lib/admin-data";
import { STAGES, STAGE_LABEL } from "@/lib/demo-data";
import { moneyC, shortCar } from "@/lib/format";

export const Route = createFileRoute("/admin/deals/")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Deals · Admin · OwnerFi" }] }),
  component: DealsPage,
});

const OPEN_STAGES = STAGES.filter((s) => s !== "paid_off");
const SIZE = 12;

function Tile({ r }: { r: DealRow }) {
  return (
    <AppLink to={`/admin/deals/${r.id}`} className="block rounded-xl border border-ink/10 bg-white p-3 shadow-card transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="flex items-center gap-2">
        <CarImage src={r.deal.photo} alt="" className="h-10 w-14 shrink-0 rounded-lg" />
        <p className="min-w-0 truncate text-sm font-semibold">{shortCar(r.deal.car)}</p>
      </div>
      <p className="mt-2 text-sm text-muted">
        {r.deal.buyer} → {r.deal.seller}
      </p>
      <p className="num mt-1 text-sm font-semibold">{moneyC(r.price)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">{r.deal.updated}</span>
        {r.stuck && <Badge tone="warning">Stuck {r.idleDays}d</Badge>}
        {r.paused && <Badge>Paused</Badge>}
        {r.late && <Badge tone="danger">Late</Badge>}
      </div>
    </AppLink>
  );
}

function DealsPage() {
  const m = useAdminModel();
  const navigate = useNavigate();
  const { params, set, clear } = useUrlParams();
  const sort = useSortParam("-updated", ["price", "updated"]);
  const view = params.get("view") === "table" ? "table" : "board";
  const stage = OPEN_STAGES.find((s) => s === params.get("stage")) ?? "all";
  const q = params.get("q") ?? "";
  const seller = params.get("seller") ?? "";
  const buyer = params.get("buyer") ?? "";
  const stuck = params.get("stuck") === "1";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const sellers = useMemo(() => [...new Set(m.dealRows.map((r) => r.deal.seller))].sort(), [m.dealRows]);
  const buyers = useMemo(() => [...new Set(m.dealRows.map((r) => r.deal.buyer))].sort(), [m.dealRows]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return m.dealRows
      .filter((r) => !isClosedStage(r.deal.stage))
      .filter((r) => stage === "all" || r.deal.stage === stage)
      .filter((r) => !seller || r.deal.seller === seller)
      .filter((r) => !buyer || r.deal.buyer === buyer)
      .filter((r) => !stuck || r.stuck)
      .filter((r) => !needle || `${r.deal.car} ${r.deal.buyer} ${r.deal.seller} ${r.id}`.toLowerCase().includes(needle));
  }, [m.dealRows, stage, q, seller, buyer, stuck]);
  const table = useMemo(
    () => [...rows].sort((a, b) => (sort.sortKey === "price" ? a.price - b.price : a.idleDays - b.idleDays) * (sort.sortDir === "asc" ? 1 : -1) * (sort.sortKey === "price" ? 1 : -1)),
    [rows, sort.sortKey, sort.sortDir],
  );
  const open = m.dealRows.filter((r) => !isClosedStage(r.deal.stage));
  const filtering = stage !== "all" || q !== "" || seller !== "" || buyer !== "" || stuck;

  const empty = (
    <EmptyState
      icon={<Handshake aria-hidden className="h-6 w-6" />}
      title={filtering ? "No deals match" : "No deals yet"}
      description={filtering ? "Try a different search or filter." : "Deals start when a buyer asks about a car."}
      action={filtering ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : <AppLink to="/admin/vehicles" className="font-semibold text-primary hover:underline">See vehicles</AppLink>}
    />
  );

  return (
    <AdminPage>
      <AdminHeader
        title="Deals"
        description={`${open.length} open deals · ${open.filter((r) => r.stuck).length} stuck · ${open.filter((r) => r.paused).length} paused`}
        action={
          <AppLink to="/admin/closed-deals" className="font-semibold text-primary hover:underline">
            See closed deals
          </AppLink>
        }
      />
      <div className="mb-4">
        <Segmented label="View" value={view} onChange={(v) => set({ view: v === "board" ? null : v })} options={[{ value: "board", label: "Board" }, { value: "table", label: "Table" }]} />
      </div>
      <FilterBar label="Filter deals">
        <TextInput aria-label="Search deals" size="sm" placeholder="Car, person or deal id" wrapperClassName="w-full sm:w-64" leftAdornment={<Search aria-hidden className="h-4 w-4" />} value={q} onChange={(e) => set({ q: e.target.value })} />
        <NativeSelect aria-label="Stage" size="sm" className="sm:w-44" value={stage} onChange={(e) => set({ stage: e.target.value === "all" ? null : e.target.value })} options={[{ value: "all", label: "All open stages" }, ...OPEN_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))]} />
        <NativeSelect aria-label="Seller" size="sm" className="sm:w-44" value={seller} onChange={(e) => set({ seller: e.target.value })} options={[{ value: "", label: "All sellers" }, ...sellers.map((s) => ({ value: s, label: s }))]} />
        <NativeSelect aria-label="Buyer" size="sm" className="sm:w-44" value={buyer} onChange={(e) => set({ buyer: e.target.value })} options={[{ value: "", label: "All buyers" }, ...buyers.map((s) => ({ value: s, label: s }))]} />
        <button
          type="button"
          aria-pressed={stuck}
          onClick={() => set({ stuck: stuck ? null : "1" })}
          className={`h-10 rounded-xl border px-3.5 text-sm font-semibold ${stuck ? "border-primary bg-primary/10 text-primary-700" : "border-ink/15 bg-white text-ink hover:bg-surface"}`}
        >
          Stuck 7+ days
        </button>
      </FilterBar>

      {view === "board" ? (
        rows.length === 0 ? (
          <Card>{empty}</Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-3" role="list" aria-label="Deals by stage">
            {OPEN_STAGES.map((st) => {
              const col = rows.filter((r) => r.deal.stage === st);
              return (
                <section key={st} role="listitem" aria-label={STAGE_LABEL[st]} className="w-64 shrink-0 rounded-2xl bg-surface p-2">
                  <h2 className="flex items-center justify-between px-2 py-2 text-sm font-semibold">
                    {STAGE_LABEL[st]}
                    <span className="num rounded-full bg-white px-2 py-0.5 text-xs text-muted">{col.length}</span>
                  </h2>
                  <div className="space-y-2">{col.length === 0 ? <p className="px-2 py-4 text-center text-sm text-muted">No deals</p> : col.map((r) => <Tile key={r.id} r={r} />)}</div>
                </section>
              );
            })}
          </div>
        )
      ) : (
        <DataTable<DealRow>
          caption="Deals"
          rows={pageOf(table, page, SIZE)}
          total={table.length}
          page={page}
          pageSize={SIZE}
          onPageChange={(p) => set({ page: String(p) })}
          getRowId={(r) => r.id}
          sortKey={sort.sortKey}
          sortDir={sort.sortDir}
          onSort={sort.onSort}
          columns={[
            {
              key: "deal",
              header: "Deal",
              render: (r) => (
                <button type="button" onClick={() => navigate({ to: "/admin/deals/$id", params: { id: r.id } })} className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <CarImage src={r.deal.photo} alt="" className="h-10 w-14 shrink-0 rounded-lg" />
                  <span>
                    <span className="block font-semibold text-ink">{shortCar(r.deal.car)}</span>
                    <span className="block text-muted">{r.id}</span>
                  </span>
                </button>
              ),
            },
            { key: "buyer", header: "Buyer", render: (r) => r.deal.buyer },
            { key: "seller", header: "Seller", render: (r) => r.deal.seller },
            { key: "stage", header: "Stage", render: (r) => <StatusChip kind="deal" value={r.deal.stage} /> },
            { key: "price", header: "Price", sortable: true, align: "right", render: (r) => moneyC(r.price) },
            { key: "updated", header: "Updated", sortable: true, render: (r) => r.deal.updated },
            { key: "idle", header: "Idle", align: "right", render: (r) => (r.stuck ? <Badge tone="warning">{r.idleDays} days</Badge> : `${r.idleDays} days`) },
            { key: "flags", header: "Flags", render: (r) => (r.paused || r.late ? <span className="flex flex-wrap gap-1">{r.paused && <Badge>Paused</Badge>}{r.late && <Badge tone="danger">Late</Badge>}</span> : "—") },
          ]}
          emptyState={empty}
        />
      )}
    </AdminPage>
  );
}
