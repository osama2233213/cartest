import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { Download, Receipt, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppLink, Avatar, Badge, Button, Card, CardHeader, EmptyState, NativeSelect, TextInput, useToast } from "@/components/kit";
import { AdminHeader, AdminPage, DataTable, FilterBar, FilterTabs, KpiCard, anySearch, pageOf, useSortParam, useUrlParams } from "@/components/admin/kit";
import { RevenueChart } from "@/components/admin/charts";
import { dateShort, fileCsv, revenueSummary, useAdminModel, type FeeRow } from "@/lib/admin-data";
import { moneyC } from "@/lib/format";

export const Route = createFileRoute("/admin/revenue")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Revenue · Admin · OwnerFi" }] }),
  component: Revenue,
});

const STATUS = [
  { id: "all", label: "All" },
  { id: "collected", label: "Collected" },
  { id: "waived", label: "Waived" },
  { id: "refunded", label: "Refunded" },
];
const TONE = { collected: { tone: "success", label: "Collected" }, waived: { tone: "neutral", label: "Waived" }, refunded: { tone: "warning", label: "Refunded" } } as const;
const SIZE = 12;
const vs = (a: number, b: number) => {
  const d = a - b;
  return Math.abs(d) < 0.005 ? "Same as last month" : `${d > 0 ? "Up" : "Down"} ${moneyC(Math.abs(d))} on last month`;
};

function Revenue() {
  const m = useAdminModel();
  const toast = useToast();
  const { params, set, clear } = useUrlParams();
  const sort = useSortParam("-date", ["date", "fee"]);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const sum = revenueSummary(m);
  const status = STATUS.find((s) => s.id === params.get("status"))?.id ?? "all";
  const month = params.get("month") ?? "all";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const months = useMemo(() => [...new Set(m.fees.map((f) => format(new Date(f.at), "yyyy-MM")))].sort().reverse(), [m.fees]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return m.fees
      .filter((f) => status === "all" || f.status === status)
      .filter((f) => month === "all" || format(new Date(f.at), "yyyy-MM") === month)
      .filter((f) => !needle || `${f.sellerName} ${f.dealId}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const d = sort.sortKey === "fee" ? a.fee - b.fee : a.at.localeCompare(b.at);
        return sort.sortDir === "asc" ? d : -d;
      });
  }, [m.fees, status, month, q, sort.sortKey, sort.sortDir]);
  const filtering = status !== "all" || month !== "all" || q !== "";

  const exportCsv = () => {
    setBusy(true);
    try {
      const n = fileCsv("ownerfi-fee-ledger.csv", [["Date", "Deal", "Seller", "Down payment", "Fee", "Status"], ...rows.map((r) => [dateShort(r.at), r.dealId, r.sellerName, r.downPayment / 100, r.fee / 100, r.status])]);
      toast({ tone: "success", title: `Exported ${n} ${n === 1 ? "fee" : "fees"}.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage>
      <AdminHeader title="Revenue" description="OwnerFi earns a fee on each down payment. Monthly payments go straight to sellers with no fee." action={<Button variant="secondary" loading={busy} leftIcon={<Download aria-hidden className="h-4 w-4" />} onClick={exportCsv}>Export CSV</Button>} />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="This month" value={moneyC(sum.totals.thisMonth)} hint={vs(sum.totals.thisMonth, sum.totals.lastMonth)} />
        <KpiCard label="Year to date" value={moneyC(sum.totals.ytd)} />
        <KpiCard label="All time" value={moneyC(sum.totals.allTime)} hint={`${sum.totals.deals} deals`} />
        <KpiCard label="Fees waived" value={sum.totals.waivedCount} hint={`Beta sellers · ${moneyC(sum.totals.waivedForgone)} not charged`} />
      </div>
      <div className="mb-6">
        <RevenueChart data={sum.byMonth} title="Fees by month" className="w-full" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top sellers" description="Who has paid the most in fees." />
          {sum.top.length === 0 ? (
            <p className="text-muted">No fees yet.</p>
          ) : (
            <ol className="divide-y divide-ink/10">
              {sum.top.map((t) => (
                <li key={t.sellerId} className="flex items-center gap-3 py-3">
                  <Avatar name={t.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    {t.seller ? (
                      <AppLink to={`/admin/users/${t.seller.id}`} className="rounded font-semibold hover:underline">
                        {t.name}
                      </AppLink>
                    ) : (
                      <span className="font-semibold">{t.name}</span>
                    )}
                    <p className="text-sm text-muted">
                      {t.deals} {t.deals === 1 ? "deal" : "deals"}
                    </p>
                  </div>
                  <span className="num font-semibold">{moneyC(t.fee)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card>
          <CardHeader title="What’s next" description="Based on the average of the last 3 full months." action={<Badge tone="primary">Estimate</Badge>} />
          <ul className="divide-y divide-ink/10">
            {sum.projection.map((p) => (
              <li key={p.month} className="flex items-center justify-between py-3">
                <span>{p.label}</span>
                <span className="num font-semibold">{moneyC(p.fee)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">Mock numbers. This is not a forecast of growth.</p>
        </Card>
      </div>

      <h2 className="mb-3 text-xl font-semibold">Fee ledger</h2>
      <FilterBar>
        <FilterTabs idPrefix="fee" value={status} onChange={(v) => set({ status: v === "all" ? null : v })} items={STATUS} />
        <NativeSelect aria-label="Month" size="sm" className="sm:w-48" value={month} onChange={(e) => set({ month: e.target.value === "all" ? null : e.target.value })} options={[{ value: "all", label: "All months" }, ...months.map((x) => ({ value: x, label: format(new Date(`${x}-01T12:00:00`), "MMMM yyyy") }))]} />
        <TextInput aria-label="Search" size="sm" placeholder="Seller or deal id" wrapperClassName="w-full sm:w-72" leftAdornment={<Search aria-hidden className="h-4 w-4" />} value={q} onChange={(e) => set({ q: e.target.value })} />
      </FilterBar>
      <DataTable<FeeRow>
        caption="Fee ledger"
        rows={pageOf(rows, page, SIZE)}
        total={rows.length}
        page={page}
        pageSize={SIZE}
        onPageChange={(p) => set({ page: String(p) })}
        getRowId={(r) => r.id}
        sortKey={sort.sortKey}
        sortDir={sort.sortDir}
        onSort={sort.onSort}
        columns={[
          { key: "date", header: "Date", sortable: true, render: (r) => dateShort(r.at) },
          { key: "deal", header: "Deal", render: (r) => (r.live ? <AppLink to={`/admin/deals/${r.dealId}`} className="rounded font-semibold text-primary hover:underline">{r.dealId}</AppLink> : <span className="text-muted">Earlier deal</span>) },
          { key: "seller", header: "Seller", render: (r) => r.sellerName },
          { key: "down", header: "Down payment", align: "right", render: (r) => moneyC(r.downPayment) },
          {
            key: "fee",
            header: "Fee",
            sortable: true,
            align: "right",
            render: (r) => (
              <span className={r.status === "refunded" ? "text-muted line-through" : "font-semibold"}>
                {moneyC(r.fee)}
                {r.status === "waived" && <span className="block text-sm font-normal text-muted no-underline">Beta — waived</span>}
              </span>
            ),
          },
          { key: "status", header: "Status", render: (r) => <Badge tone={TONE[r.status].tone}>{TONE[r.status].label}</Badge> },
        ]}
        emptyState={
          <EmptyState
            icon={<Receipt aria-hidden className="h-6 w-6" />}
            title={filtering ? "No fees match" : "No fees yet"}
            description={filtering ? "Try a different month, status or search." : "Fees show up here when a buyer pays a down payment."}
            action={filtering ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : <AppLink to="/admin/deals" className="font-semibold text-primary hover:underline">See deals</AppLink>}
          />
        }
      />

      <Card className="mt-6">
        <CardHeader
          title="Stripe check"
          description="Fees in the ledger against fees Stripe sent to OwnerFi."
          action={
            <Button
              variant="secondary"
              loading={checking}
              onClick={() => {
                setChecking(true);
                setTimeout(() => {
                  setChecking(false);
                  toast({ tone: "success", title: "All fees match Stripe." });
                }, 600);
              }}
            >
              Run check
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left">
            <caption className="sr-only">Stripe reconciliation by month</caption>
            <thead className="text-sm text-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Month</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">In the ledger</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">From Stripe</th>
                <th scope="col" className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {sum.reconciliation.map((r) => (
                <tr key={r.month}>
                  <td className="py-3 pr-4">{r.label}</td>
                  <td className="num py-3 pr-4 text-right">{moneyC(r.ledger)}</td>
                  <td className="num py-3 pr-4 text-right">{r.status === "pending" ? "—" : moneyC(r.received)}</td>
                  <td className="py-3">
                    <Badge tone={r.status === "matched" ? "success" : "neutral"}>{r.status === "matched" ? "Matched" : "Pending"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">Mock data. OwnerFi never holds seller money; Stripe sends the fee to OwnerFi’s account.</p>
      </Card>
    </AdminPage>
  );
}
