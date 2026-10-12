import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Archive, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, EmptyState, TextInput, useToast } from "@/components/kit";
import { AdminHeader, AdminPage, DataTable, FilterBar, FilterTabs, KpiCard, anySearch, pageOf, useSortParam, useUrlParams } from "@/components/admin/kit";
import { StatusChip } from "@/components/status";
import { dateShort, fileCsv, useAdminModel, type ClosedRow } from "@/lib/admin-data";
import { moneyC } from "@/lib/format";

export const Route = createFileRoute("/admin/closed-deals")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Closed deals · Admin · OwnerFi" }] }),
  component: ClosedDeals,
});

const OUTCOMES = [
  { id: "all", label: "All" },
  { id: "paid_off", label: "Paid off" },
  { id: "defaulted", label: "Defaulted" },
  { id: "cancelled", label: "Cancelled" },
];
const SIZE = 12;
const duration = (n: number) => (n < 1 ? "Under a month" : `${n} ${n === 1 ? "month" : "months"}`);

function ClosedDeals() {
  const m = useAdminModel();
  const navigate = useNavigate();
  const toast = useToast();
  const { params, set, clear } = useUrlParams();
  const sort = useSortParam("-closed", ["closed", "fee"]);
  const [busy, setBusy] = useState(false);
  const outcome = OUTCOMES.find((o) => o.id === params.get("outcome"))?.id ?? "all";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return m.closed
      .filter((r) => outcome === "all" || r.outcome === outcome)
      .filter((r) => !needle || `${r.car} ${r.buyer} ${r.seller} ${r.dealId ?? r.key}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const d = sort.sortKey === "fee" ? a.fee - b.fee : a.closedAt.localeCompare(b.closedAt);
        return sort.sortDir === "asc" ? d : -d;
      });
  }, [m.closed, outcome, q, sort.sortKey, sort.sortDir]);
  const fee = rows.reduce((s, r) => s + r.fee, 0);
  const avg = rows.length ? rows.reduce((s, r) => s + r.durationMonths, 0) / rows.length : 0;
  const filtering = outcome !== "all" || q !== "";

  const exportCsv = () => {
    setBusy(true);
    try {
      const n = fileCsv("ownerfi-closed-deals.csv", [
        ["Closed", "Car", "Seller", "Buyer", "Price", "Down payment", "Fee", "Outcome", "Months"],
        ...rows.map((r) => [dateShort(r.closedAt), r.car, r.seller, r.buyer, r.price / 100, r.downPayment / 100, r.fee / 100, r.outcome, r.durationMonths]),
      ]);
      toast({ tone: "success", title: `Exported ${n} ${n === 1 ? "deal" : "deals"}.` });
    } catch {
      toast({ tone: "danger", title: "The export didn’t work. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage>
      <AdminHeader title="Closed deals" description="Paid off, defaulted or cancelled after the down payment." action={<Button variant="secondary" loading={busy} leftIcon={<Download aria-hidden className="h-4 w-4" />} onClick={exportCsv}>Export CSV</Button>} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Deals closed" value={rows.length} />
        <KpiCard label="Fee earned" value={moneyC(fee)} hint="From down payments" />
        <KpiCard label="Average duration" value={`${avg.toFixed(1)} months`} />
      </div>
      <FilterBar>
        <FilterTabs idPrefix="closed" value={outcome} onChange={(v) => set({ outcome: v === "all" ? null : v })} items={OUTCOMES} />
        <TextInput aria-label="Search" size="sm" placeholder="Car, buyer, seller or deal id" wrapperClassName="w-full sm:w-72" leftAdornment={<Search aria-hidden className="h-4 w-4" />} value={q} onChange={(e) => set({ q: e.target.value })} />
      </FilterBar>
      <DataTable<ClosedRow>
        caption="Closed deals"
        rows={pageOf(rows, page, SIZE)}
        total={rows.length}
        page={page}
        pageSize={SIZE}
        onPageChange={(p) => set({ page: String(p) })}
        getRowId={(r) => r.key}
        sortKey={sort.sortKey}
        sortDir={sort.sortDir}
        onSort={sort.onSort}
        columns={[
          {
            key: "closed",
            header: "Closed",
            sortable: true,
            render: (r) =>
              r.dealId ? (
                <button type="button" onClick={() => navigate({ to: "/admin/deals/$id", params: { id: r.dealId! } })} className="rounded-lg text-left font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {dateShort(r.closedAt)}
                </button>
              ) : (
                dateShort(r.closedAt)
              ),
          },
          { key: "car", header: "Car", render: (r) => r.car },
          { key: "seller", header: "Seller", render: (r) => r.seller },
          { key: "buyer", header: "Buyer", render: (r) => r.buyer },
          { key: "price", header: "Price", align: "right", render: (r) => moneyC(r.price) },
          { key: "down", header: "Down payment", align: "right", render: (r) => moneyC(r.downPayment) },
          { key: "fee", header: "Fee earned", sortable: true, align: "right", render: (r) => <span className="font-semibold">{moneyC(r.fee)}</span> },
          { key: "outcome", header: "Outcome", render: (r) => <StatusChip kind="deal" value={r.outcome} /> },
          { key: "duration", header: "Duration", render: (r) => duration(r.durationMonths) },
        ]}
        emptyState={
          <EmptyState
            icon={<Archive aria-hidden className="h-6 w-6" />}
            title={filtering ? "No closed deals match" : "No closed deals yet"}
            description={filtering ? "Try a different search or outcome." : "They show up here once a car is paid off, cancelled or defaulted."}
            action={filtering ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined}
          />
        }
      />
    </AdminPage>
  );
}
