import { createFileRoute } from "@tanstack/react-router";
import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
import { format } from "date-fns/format";
import { Copy, CreditCard, Gavel, MoreHorizontal, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { AppLink, Badge, Breakdown, Button, EmptyState, Modal, NativeSelect, TextArea, TextInput, useToast, Alert } from "@/components/kit";
import { ActionMenu, AdminHeader, AdminPage, ConfirmModal, DataTable, FilterBar, FilterTabs, KpiCard, anySearch, pageOf, useAction, useSortParam, useUrlParams } from "@/components/admin/kit";
import { StatusChip } from "@/components/status";
import { dateShort, dateTime, useAdminActions, useAdminModel, type AdminModel, type AdminPayment, type Dispute } from "@/lib/admin-data";
import { moneyC } from "@/lib/format";

export const Route = createFileRoute("/admin/payments")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Payments · Admin · OwnerFi" }] }),
  component: Payments,
});

const KIND = { down_payment: "Down payment", monthly: "Monthly payment", payoff: "Payoff" } as const;
const REASONS = ["Duplicate charge", "Seller didn’t deliver", "Buyer requested", "Fraud", "Other"];
const RANGES = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];
const SIZE = 12;
const first = (n: string) => n.split(" ")[0] ?? n;
const dueIn = (iso: string) => differenceInCalendarDays(new Date(iso), new Date());

function Timeline({ p, dispute }: { p: AdminPayment; dispute?: Dispute | undefined }) {
  const ev: { at: string; label: string; detail?: string }[] = [{ at: p.dueAt, label: "Payment created" }];
  if (p.status === "failed") ev.push({ at: p.dueAt, label: "Failed", detail: p.failureReason ?? "The bank declined it." });
  if (p.paidAt && p.status !== "failed") ev.push({ at: p.paidAt, label: "Paid", detail: p.method === "ach" ? "Bank transfer" : "Card" });
  if (p.refundedAt) ev.push({ at: p.refundedAt, label: "Refunded", detail: [p.refundReason, p.refundedBy && `by ${p.refundedBy}`].filter(Boolean).join(" · ") });
  if (dispute) ev.push({ at: dispute.openedAt, label: "Dispute opened", detail: dispute.reason });
  ev.sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol className="space-y-3 border-l border-ink/10 pl-4">
      {ev.map((e, i) => (
        <li key={i}>
          <p className="font-semibold">{e.label}</p>
          {e.detail && <p className="text-sm text-muted">{e.detail}</p>}
          <p className="text-sm text-muted">{dateTime(e.at)}</p>
        </li>
      ))}
    </ol>
  );
}

function RefundModal({ p, onClose, onRefund, busy, error }: { p: AdminPayment; onClose: () => void; onRefund: (reason: string, note: string) => void; busy: boolean; error?: string | undefined }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const needsNote = reason === "Other";
  const ok = !!reason && (!needsNote || note.trim().length >= 10);
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Refund this payment?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={!ok} onClick={() => onRefund(reason, note)}>Refund {moneyC(p.amount)}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Alert tone="info">
          {p.kind === "down_payment" ? `${first(p.buyerName)} gets ${moneyC(p.amount)} back. OwnerFi’s ${moneyC(p.fee)} fee goes back to ${first(p.sellerName)} too.` : `${first(p.buyerName)} gets ${moneyC(p.amount)} back. Stripe takes it from ${first(p.sellerName)}’s balance.`}
        </Alert>
        <NativeSelect label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={[{ value: "", label: "Pick a reason" }, ...REASONS.map((r) => ({ value: r, label: r }))]} />
        <TextArea label={needsNote ? "Note" : "Note (optional)"} required={needsNote} helper={needsNote ? "At least 10 characters." : undefined} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        <p className="text-sm text-muted">The deal stays where it is. To cancel it, use the deal page.</p>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

function Detail({ p, m, onClose }: { p: AdminPayment; m: AdminModel; onClose: () => void }) {
  const toast = useToast();
  const acts = useAdminActions(m);
  const a = useAction();
  const [refund, setRefund] = useState(false);
  const dispute = m.s.disputes.find((d) => d.paymentId === p.id);
  const paid = p.status === "paid";
  const id = p.stripeRef.replace(/^pi_/, "");
  const copy = (v: string) => {
    void navigator.clipboard?.writeText(v);
    toast({ tone: "success", title: "Copied." });
  };
  const h = "mb-2 text-sm font-semibold uppercase tracking-wide text-muted";
  return (
    <>
      <Modal
        open
        size="lg"
        onClose={onClose}
        title={`${moneyC(p.amount)} · ${KIND[p.kind]}`}
        footer={
          paid ? (
            <Button variant="danger" onClick={() => { a.clearError(); setRefund(true); }}>Refund payment</Button>
          ) : (
            <p className="text-sm text-muted">{p.status === "refunded" && p.refundedAt ? `Already refunded on ${dateShort(p.refundedAt)}.` : "Nothing to refund."}</p>
          )
        }
      >
        <div className="space-y-6">
          <StatusChip kind="payment" value={p.status} />
          <section>
            <h3 className={h}>Who</h3>
            <p>{p.buyerName} paid {p.sellerName} for the {p.car}.</p>
            <AppLink to={`/admin/deals/${p.dealId}`} className="mt-1 inline-block font-semibold text-primary hover:underline">Open deal {p.dealId}</AppLink>
          </section>
          <section>
            <h3 className={h}>Money</h3>
            <Breakdown
              rows={p.kind === "down_payment" ? [{ label: "Payment", value: moneyC(p.amount) }, { label: "OwnerFi fee", value: p.fee === 0 ? "$0" : `− ${moneyC(p.fee)}`, hint: p.fee === 0 ? "Beta — waived" : "Paid from the seller’s side", tone: "negative" }] : [{ label: "Payment", value: moneyC(p.amount) }]}
              {...(p.kind === "down_payment" ? { total: { label: "Seller receives", value: moneyC(p.amount - p.fee) } } : {})}
            />
            {p.kind !== "down_payment" && <p className="text-sm text-muted">Goes straight to the seller. No OwnerFi fee.</p>}
          </section>
          <section>
            <h3 className={h}>Stripe (mock)</h3>
            <ul className="space-y-1">
              {[["Payment", p.stripeRef], ["Charge", `ch_${id}`], ["Transfer", `tr_${id}`]].map(([l, v]) => (
                <li key={l} className="flex items-center justify-between gap-2">
                  <span className="text-muted">{l}</span>
                  <span className="flex items-center gap-1 font-mono text-sm">
                    {v}
                    <button type="button" aria-label={`Copy ${l!.toLowerCase()} id`} onClick={() => copy(v!)} className="rounded-lg p-2 text-muted hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <Copy aria-hidden className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className={h}>Timeline</h3>
            <Timeline p={p} dispute={dispute} />
          </section>
          {dispute && (
            <section>
              <h3 className={h}>Dispute</h3>
              <StatusChip kind="dispute" value={dispute.status} />
              <p className="mt-2">{dispute.reason}</p>
            </section>
          )}
        </div>
      </Modal>
      {refund && <RefundModal p={p} busy={a.busy === "refund"} error={a.error} onClose={() => setRefund(false)} onRefund={(r, n) => void a.run("refund", () => acts.payments.refund(p, r, n), `Refunded ${moneyC(p.amount)}. Both people were told.`).then((ok) => ok && setRefund(false))} />}
    </>
  );
}

function Disputes({ m, rows }: { m: AdminModel; rows: Dispute[] }) {
  const acts = useAdminActions(m);
  const a = useAction();
  const [accept, setAccept] = useState<Dispute | undefined>();
  const pay = (d: Dispute) => m.payments.find((p) => p.id === d.paymentId);
  const note = (d: Dispute) => (d.status === "won" ? "Won — the charge stands." : d.status === "lost" ? `Lost — ${moneyC(d.amount)} went back to the buyer.` : undefined);
  return (
    <>
      <DataTable<Dispute>
        caption="Disputes"
        rows={rows}
        getRowId={(d) => d.id}
        columns={[
          { key: "opened", header: "Opened", render: (d) => dateShort(d.openedAt) },
          { key: "deal", header: "Deal", render: (d) => <AppLink to={`/admin/deals/${d.dealId}`} className="rounded font-semibold text-primary hover:underline">{d.dealId}</AppLink> },
          { key: "people", header: "Buyer → Seller", render: (d) => `${pay(d)?.buyerName ?? "—"} → ${pay(d)?.sellerName ?? "—"}` },
          { key: "amount", header: "Amount", align: "right", render: (d) => <span className="font-semibold">{moneyC(d.amount)}</span> },
          { key: "reason", header: "Reason", render: (d) => d.reason },
          {
            key: "due",
            header: "Reply by",
            render: (d) => {
              const left = dueIn(d.dueBy);
              return (
                <>
                  {dateShort(d.dueBy)}
                  {d.status === "needs_response" && left <= 3 && <Badge tone="danger" className="ml-2">{left < 0 ? "Overdue" : `Due in ${left}d`}</Badge>}
                </>
              );
            },
          },
          { key: "status", header: "Status", render: (d) => (<><StatusChip kind="dispute" value={d.status} />{note(d) && <span className="mt-1 block text-sm text-muted">{note(d)}</span>}</>) },
          {
            key: "actions",
            header: "Actions",
            render: (d) => {
              const items =
                d.status === "needs_response"
                  ? [{ label: "Submit evidence", onSelect: () => void a.run("ev", () => acts.payments.submitEvidence(d.id), "Evidence sent to Stripe.") }, { label: "Accept dispute", danger: true, onSelect: () => { a.clearError(); setAccept(d); } }]
                  : d.status === "under_review"
                    ? [{ label: "Demo: bank decides — won", onSelect: () => void a.run("w", () => acts.payments.simulate(d.id, "won"), "Dispute won.") }, { label: "Demo: bank decides — lost", onSelect: () => void a.run("l", () => acts.payments.simulate(d.id, "lost"), "Dispute lost.") }]
                    : [];
              return items.length === 0 ? (
                <span className="text-muted">—</span>
              ) : (
                <ActionMenu triggerLabel={`Actions for dispute on ${d.dealId}`} items={items} trigger={<span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/15 px-3 text-sm font-semibold"><MoreHorizontal aria-hidden className="h-4 w-4" /> Actions</span>} />
              );
            },
          },
        ]}
        emptyState={<EmptyState icon={<Gavel aria-hidden className="h-6 w-6" />} title="No disputes" description="That’s a good thing." />}
      />
      <ConfirmModal open={!!accept} title="Accept this dispute?" body={`The buyer gets ${moneyC(accept?.amount ?? 0)} back and you can’t undo it.`} confirmLabel="Accept dispute" tone="danger" busy={a.busy === "acc"} error={a.error} onClose={() => setAccept(undefined)} onConfirm={() => accept && void a.run("acc", () => acts.payments.acceptDispute(accept.id), "Dispute accepted.").then((ok) => ok && setAccept(undefined))} />
    </>
  );
}

function Payments() {
  const m = useAdminModel();
  const { params, set, clear } = useUrlParams();
  const sort = useSortParam("-date", ["date", "amount"]);
  const tab = (["all", "failed", "disputes"] as const).find((t) => t === params.get("tab")) ?? "all";
  const kind = params.get("kind") ?? "all";
  const status = params.get("status") ?? "all";
  const range = params.get("range") ?? "all";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const openId = params.get("id");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cutoff = range === "30d" ? 30 : range === "90d" ? 90 : range === "12m" ? 365 : 0;
    return m.payments
      .filter((p) => (tab === "failed" ? p.status === "failed" : true))
      .filter((p) => tab !== "all" || ((kind === "all" || p.kind === kind) && (status === "all" || p.status === status)))
      .filter((p) => !cutoff || differenceInCalendarDays(new Date(), new Date(p.paidAt ?? p.dueAt)) <= cutoff)
      .filter((p) => !needle || `${p.dealId} ${p.car} ${p.buyerName} ${p.sellerName} ${p.stripeRef}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const d = sort.sortKey === "amount" ? a.amount - b.amount : (a.paidAt ?? a.dueAt).localeCompare(b.paidAt ?? b.dueAt);
        return sort.sortDir === "asc" ? d : -d;
      });
  }, [m.payments, tab, kind, status, range, q, sort.sortKey, sort.sortDir]);
  const failed = m.payments.filter((p) => p.status === "failed").length;
  const openDisputes = m.s.disputes.filter((d) => d.status === "needs_response" || d.status === "under_review").length;
  const needReply = m.s.disputes.filter((d) => d.status === "needs_response").length;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const paidThisMonth = m.payments.filter((p) => p.status === "paid" && (p.paidAt ?? "") >= monthStart).reduce((s, p) => s + p.amount, 0);
  const refundedTotal = m.payments.filter((p) => p.status === "refunded").reduce((s, p) => s + p.amount, 0);
  const filtering = kind !== "all" || status !== "all" || range !== "all" || q !== "";
  const picked = openId ? m.payments.find((p) => p.id === openId) : undefined;
  const showReason = tab === "failed";

  return (
    <AdminPage>
      <AdminHeader title="Payments" description="Every charge, refund and dispute on the platform." />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Paid this month" value={moneyC(paidThisMonth)} />
        <KpiCard label="Failed" value={failed} hint={failed > 0 ? "The buyer can retry" : undefined} />
        <KpiCard label="Refunded" value={moneyC(refundedTotal)} hint="All time" />
        <KpiCard label="Open disputes" value={openDisputes} hint={needReply > 0 ? `${needReply} need a reply` : undefined} />
      </div>
      <FilterTabs idPrefix="pay" value={tab} onChange={(v) => set({ tab: v === "all" ? null : v, id: null })} className="mb-4" items={[{ id: "all", label: "All transactions" }, { id: "failed", label: "Failed", count: failed }, { id: "disputes", label: "Disputes", count: openDisputes }]} />
      {tab === "disputes" ? (
        <Disputes m={m} rows={m.s.disputes} />
      ) : (
        <>
          <FilterBar>
            {tab === "all" && (
              <>
                <NativeSelect aria-label="Type" size="sm" className="sm:w-44" value={kind} onChange={(e) => set({ kind: e.target.value === "all" ? null : e.target.value })} options={[{ value: "all", label: "All types" }, ...Object.entries(KIND).map(([v, l]) => ({ value: v, label: l }))]} />
                <NativeSelect aria-label="Status" size="sm" className="sm:w-40" value={status} onChange={(e) => set({ status: e.target.value === "all" ? null : e.target.value })} options={[{ value: "all", label: "Any status" }, { value: "paid", label: "Paid" }, { value: "failed", label: "Failed" }, { value: "refunded", label: "Refunded" }]} />
                <NativeSelect aria-label="Date" size="sm" className="sm:w-44" value={range} onChange={(e) => set({ range: e.target.value === "all" ? null : e.target.value })} options={RANGES} />
              </>
            )}
            <TextInput aria-label="Search" size="sm" placeholder="Deal, car, name or Stripe id" wrapperClassName="w-full sm:w-72" leftAdornment={<Search aria-hidden className="h-4 w-4" />} value={q} onChange={(e) => set({ q: e.target.value })} />
          </FilterBar>
          {tab === "failed" && <p className="mb-3 text-muted">The buyer is told and can retry from their payments page. You don’t need to do anything unless it keeps failing.</p>}
          <DataTable<AdminPayment>
            caption="Transactions"
            rows={pageOf(rows, page, SIZE)}
            total={rows.length}
            page={page}
            pageSize={SIZE}
            onPageChange={(p) => set({ page: String(p) })}
            getRowId={(p) => p.id}
            sortKey={sort.sortKey}
            sortDir={sort.sortDir}
            onSort={sort.onSort}
            columns={[
              { key: "date", header: "Date", sortable: true, render: (p) => <button type="button" onClick={() => set({ id: p.id })} className="rounded-lg text-left font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{format(new Date(p.paidAt ?? p.dueAt), "MMM d, yyyy")}</button> },
              { key: "type", header: "Type", render: (p) => KIND[p.kind] },
              { key: "deal", header: "Deal", render: (p) => <AppLink to={`/admin/deals/${p.dealId}`} className="rounded font-semibold hover:underline">{p.dealId}</AppLink> },
              { key: "people", header: "Buyer → Seller", render: (p) => `${p.buyerName} → ${p.sellerName}` },
              { key: "amount", header: "Amount", sortable: true, align: "right", render: (p) => <span className="font-semibold">{moneyC(p.amount)}</span> },
              { key: "fee", header: "OwnerFi fee", align: "right", render: (p) => (p.kind !== "down_payment" ? "—" : p.fee === 0 ? "$0 · waived" : moneyC(p.fee)) },
              { key: "method", header: "Method", render: (p) => (p.method === "ach" ? "ACH" : "Card") },
              ...(showReason ? [{ key: "reason", header: "Reason", render: (p: AdminPayment) => p.failureReason ?? "The bank declined it." }] : []),
              { key: "status", header: "Status", render: (p) => <StatusChip kind="payment" value={p.status} /> },
            ]}
            emptyState={
              showReason ? (
                <EmptyState icon={<TriangleAlert aria-hidden className="h-6 w-6" />} title="No failed payments" description="Every payment that was tried has gone through." />
              ) : (
                <EmptyState icon={<CreditCard aria-hidden className="h-6 w-6" />} title={filtering ? "No payments match" : "No payments yet"} description={filtering ? "Try a different type, status, date range or search." : "Payments show up here once a buyer pays."} action={filtering ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} />
              )
            }
          />
        </>
      )}
      {picked && <Detail p={picked} m={m} onClose={() => set({ id: null })} />}
    </AdminPage>
  );
}
