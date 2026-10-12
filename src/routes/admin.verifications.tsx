import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Image as ImageIcon, Search, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AppLink, Avatar, Badge, Button, EmptyState, Modal, NativeSelect, TextArea, TextInput, useToast } from "@/components/kit";
import { AdminHeader, AdminPage, DataTable, FilterBar, FilterTabs, anySearch, useUrlParams, useAction } from "@/components/admin/kit";
import { CarImage } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { ago_, dateShort, queueSubject, slaMinutes, useAdminActions, useAdminModel, vehicleName, type AdminModel, type QueueItem, type QueueType } from "@/lib/admin-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/verifications")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Verifications · Admin · OwnerFi" }] }),
  component: Queue,
});

const REASONS = ["Photo is unclear", "Details don’t match", "Document is not valid", "Lien or brand found", "Other"];
const CHECKS: Record<QueueType, string[]> = {
  identity: ["Face matches ID", "Document is readable", "Name matches account"],
  bank: ["Bank sign-in worked", "Account holder matches name", "Account is open"],
  title: ["Title is readable", "Lien lookup", "Title brand lookup"],
  vehicle_flag: ["Mileage matches photos", "Price vs. market", "Seller history"],
};
const TYPE_LABEL: Record<QueueType, string> = { identity: "Identity", bank: "Bank", title: "Title", vehicle_flag: "Flagged car" };
const TABS: { id: string; label: string; type: QueueType }[] = [
  { id: "identity", label: "Identity", type: "identity" },
  { id: "bank", label: "Bank", type: "bank" },
  { id: "title", label: "Title documents", type: "title" },
  { id: "flagged", label: "Flagged cars", type: "vehicle_flag" },
];
const open = (q: QueueItem) => q.status === "in_review";

function autoChecks(q: QueueItem) {
  const labels = q.scope === "credit" ? ["Date of birth matches", "Credit file found"] : CHECKS[q.type];
  const result = q.autoResult;
  return labels.map((label, i) => (result !== "pass" && i === labels.length - 1 - (q.type === "identity" && !q.scope ? 1 : 0) ? { label, result, note: q.notes ?? "Needs a manual look." } : { label, result: "pass" as const, note: undefined as string | undefined }));
}

function Sla({ sla }: { sla: string }) {
  if (sla === "done") return <span className="text-muted">—</span>;
  const urgent = slaMinutes(sla) <= 180;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", urgent ? "font-semibold text-danger" : "text-muted")}>
      <Clock aria-hidden className="h-4 w-4" />
      {sla}
    </span>
  );
}

const Sample = ({ label }: { label: string }) => (
  <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl bg-surface text-muted">
    <ImageIcon aria-hidden className="h-6 w-6" />
    <span className="text-sm font-medium text-ink">{label}</span>
    <span className="text-xs">Sample image</span>
  </div>
);
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <dt className="text-muted">{k}</dt>
    <dd className="text-right font-medium">{v}</dd>
  </div>
);

function Detail({ item, m }: { item: QueueItem; m: AdminModel }) {
  const who = queueSubject(item, m);
  const v = who.vehicle;
  const u = who.user;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{TYPE_LABEL[item.type] + (item.scope ? " (credit)" : "")}</Badge>
        <StatusChip kind="verification" value={item.status} />
        <Sla sla={item.sla} />
      </div>
      {v ? (
        <section className="space-y-3">
          <CarImage src={v.photos[0]} alt={vehicleName(v)} make={v.make} model={v.model} aspect="16/9" className="rounded-xl" />
          <dl className="divide-y divide-ink/10">
            <Row k="VIN" v={v.vin} />
            <Row k="Seller" v={v.sellerName} />
            <Row k="Lien" v={v.checks.lien} />
            <Row k="Theft" v={v.checks.theft} />
            <Row k="Title brand" v={v.checks.brand} />
          </dl>
          <Sample label="Title document" />
          <AppLink to={`/admin/vehicles/${v.id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Open vehicle <ArrowRight aria-hidden className="h-4 w-4" />
          </AppLink>
        </section>
      ) : (
        <section className="space-y-3">
          {u && (
            <dl className="divide-y divide-ink/10">
              <Row k="Name" v={u.name} />
              <Row k="Role" v={u.role === "seller" ? "Seller" : "Buyer"} />
              <Row k="State" v={u.state} />
              <Row k="Joined" v={dateShort(u.createdAt)} />
              <Row k="Email" v={u.email} />
            </dl>
          )}
          {item.type === "identity" && !item.scope && (
            <div className="grid grid-cols-3 gap-2">
              <Sample label="ID front" />
              <Sample label="ID back" />
              <Sample label="Selfie" />
            </div>
          )}
          {item.type === "bank" && u?.bankAccount && (
            <p className="rounded-xl bg-surface p-3 text-sm">
              {u.bankAccount.bank} •••• {u.bankAccount.last4} · {u.bankAccount.type}
            </p>
          )}
          {u && (
            <AppLink to={`/admin/users/${u.id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Open profile <ArrowRight aria-hidden className="h-4 w-4" />
            </AppLink>
          )}
        </section>
      )}
      <section>
        <h3 className="mb-2 font-semibold">Auto-check results</h3>
        <ul className="space-y-2">
          {autoChecks(item).map((c) => {
            const Icon = c.result === "pass" ? CheckCircle2 : c.result === "review" ? AlertTriangle : XCircle;
            return (
              <li key={c.label} className="flex items-start gap-2 text-sm">
                <Icon aria-hidden className={cn("mt-0.5 h-5 w-5 shrink-0", c.result === "pass" ? "text-success" : c.result === "review" ? "text-warning" : "text-danger")} />
                <span>
                  <span className="font-medium">{c.label}</span>
                  <span className="sr-only">{c.result === "pass" ? " — passed" : c.result === "review" ? " — needs a look" : " — failed"}</span>
                  {c.note && <span className="block text-muted">{c.note}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function ReviewModal({ item, m, onClose, onDone }: { item: QueueItem; m: AdminModel; onClose: () => void; onDone: (id: string) => void }) {
  const acts = useAdminActions(m);
  const a = useAction();
  const [note, setNote] = useState("");
  const [sub, setSub] = useState<null | "reject" | "info">(null);
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [ask, setAsk] = useState("");
  const who = queueSubject(item, m);
  const openItem = open(item);
  const finish = async (p: Promise<boolean>) => {
    if (await p) {
      setSub(null);
      setNote("");
      onDone(item.id);
    }
  };
  const why = reason === "Other" ? other.trim() : reason;
  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={who.name}
        size="lg"
        footer={
          openItem ? (
            <div className="flex flex-wrap gap-2">
              <Button loading={a.busy === "approve"} onClick={() => void finish(a.run("approve", () => acts.verification.approve(item, note), `Approved. ${who.name} was told.`))}>
                Approve
              </Button>
              <Button variant="secondary" onClick={() => setSub("info")}>
                Request more info
              </Button>
              <Button variant="ghost" className="text-danger" onClick={() => setSub("reject")}>
                Reject
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {item.status === "verified" ? "Approved" : "Rejected"}
              {item.decidedBy ? ` by ${item.decidedBy}` : ""}
              {item.reason ? `: ${item.reason}` : "."}
            </p>
          )
        }
      >
        <div className="space-y-6">
          {a.error && !sub && <Alert tone="danger">{a.error}</Alert>}
          <Detail item={item} m={m} />
          {openItem && <TextArea label="Note for the team" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />}
        </div>
      </Modal>
      <Modal
        open={sub === "reject"}
        onClose={() => setSub(null)}
        size="sm"
        title="Reject this item?"
        description="They’ll get your reason and a way to try again."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSub(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={a.busy === "reject"} disabled={!why} onClick={() => void finish(a.run("reject", () => acts.verification.reject(item, why, note), `Rejected. ${who.name} was told why.`))}>
              Reject and tell them
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <NativeSelect label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={[{ value: "", label: "Choose a reason" }, ...REASONS.map((r) => ({ value: r, label: r }))]} />
          {reason === "Other" && <TextArea label="What should they fix?" value={other} onChange={(e) => setOther(e.target.value)} rows={3} />}
        </div>
      </Modal>
      <Modal
        open={sub === "info"}
        onClose={() => setSub(null)}
        size="sm"
        title="Ask for more info"
        description="They’ll get this as a notification and an email."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSub(null)}>
              Cancel
            </Button>
            <Button loading={a.busy === "ask"} disabled={ask.trim().length < 10} onClick={() => void a.run("ask", () => acts.verification.askInfo(item, ask), "Request sent.").then((ok) => ok && setSub(null))}>
              Send request
            </Button>
          </>
        }
      >
        <TextArea label="What do you need?" helper="At least 10 characters." value={ask} onChange={(e) => setAsk(e.target.value)} rows={4} />
      </Modal>
    </>
  );
}

function Queue() {
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const toast = useToast();
  const a = useAction();
  const { params, set } = useUrlParams();
  const [show, setShow] = useState("open");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "submittedAt", dir: "desc" });
  const itemId = params.get("item");
  const items = m.s.queue;
  const target = itemId ? items.find((q) => q.id === itemId) : undefined;
  const tab = TABS.find((t) => t.id === params.get("tab")) ?? TABS.find((t) => t.type === (target ? (target.type as QueueType) : "identity")) ?? TABS[0]!;

  useEffect(() => {
    if (itemId && !target) {
      toast({ title: "That item is no longer in the queue." });
      set({ item: null });
    } else if (target) {
      const t = TABS.find((x) => x.type === target.type);
      if (t && t.id !== tab.id && !params.get("tab")) set({ tab: t.id });
    }
  }, [itemId, target, tab.id, params, set, toast]);

  const countOf = (type: QueueType) => items.filter((q) => q.type === type && open(q)).length;
  const needle = search.trim().toLowerCase();
  const rows = items
    .filter((q) => q.type === tab.type)
    .filter((q) => (show === "all" ? true : show === "open" ? open(q) : !open(q)))
    .filter((q) => {
      if (!needle) return true;
      const w = queueSubject(q, m);
      return `${w.name} ${w.sub} ${w.vehicle?.vin ?? ""}`.toLowerCase().includes(needle);
    })
    .sort((x, y) => {
      const d = sort.key === "sla" ? Math.min(slaMinutes(x.sla), 1e9) - Math.min(slaMinutes(y.sla), 1e9) : x.submittedAt.localeCompare(y.submittedAt);
      return sort.dir === "asc" ? d : -d;
    });
  const selected = rows.filter((r) => picked.includes(r.id) && open(r));

  return (
    <AdminPage>
      <AdminHeader title="Verifications" description="Check people and cars before they can sell or buy." />
      <FilterTabs idPrefix="vq" value={tab.id} onChange={(id) => { setPicked([]); set({ tab: id, item: null }); }} className="mb-4" items={TABS.map((t) => ({ id: t.id, label: t.label, count: countOf(t.type) }))} />
      <FilterBar>
        <NativeSelect label="Show" className="sm:w-40" value={show} onChange={(e) => setShow(e.target.value)} options={[{ value: "open", label: "Open" }, { value: "done", label: "Done" }, { value: "all", label: "All" }]} />
        <TextInput label="Search" aria-label="Search the queue" placeholder="Name, email, car or VIN" wrapperClassName="w-full sm:w-72" leftAdornment={<Search aria-hidden className="h-4 w-4" />} value={search} onChange={(e) => setSearch(e.target.value)} />
      </FilterBar>
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3">
          <p className="num font-semibold">{selected.length} selected</p>
          <Button size="sm" disabled={selected.some((r) => r.autoResult === "fail")} onClick={() => setBulkOpen(true)}>
            Approve selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
            Clear
          </Button>
          {selected.some((r) => r.autoResult === "fail") && <p className="w-full text-sm text-muted">Items that failed the auto-check need a single review. Unselect them to approve the rest.</p>}
        </div>
      )}
      <DataTable<QueueItem>
        caption="Verification queue"
        rows={rows}
        getRowId={(q) => q.id}
        selectable
        selectedIds={picked.filter((id) => rows.some((r) => r.id === id && open(r)))}
        onSelectionChange={(ids) => setPicked(ids.filter((id) => rows.some((r) => r.id === id && open(r))))}
        sortKey={sort.key}
        sortDir={sort.dir}
        onSort={(k) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}
        columns={[
          {
            key: "subject",
            header: "Person or car",
            render: (q) => {
              const w = queueSubject(q, m);
              return (
                <button type="button" onClick={() => set({ item: q.id })} className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Avatar name={w.name} size="sm" />
                  <span>
                    <span className="block font-semibold text-ink">{w.name}</span>
                    <span className="block text-muted">{w.sub}</span>
                  </span>
                </button>
              );
            },
          },
          { key: "type", header: "Type", render: (q) => TYPE_LABEL[q.type] + (q.scope ? " (credit)" : "") },
          { key: "submittedAt", header: "Submitted", sortable: true, render: (q) => ago_(q.submittedAt) },
          { key: "auto", header: "Auto-check", render: (q) => <StatusChip kind="check" value={q.autoResult} /> },
          { key: "status", header: "Status", render: (q) => <StatusChip kind="verification" value={q.status} /> },
          { key: "sla", header: "SLA", sortable: true, render: (q) => <Sla sla={q.sla} /> },
        ]}
        emptyState={
          <EmptyState
            icon={<ShieldCheck aria-hidden className="h-6 w-6" />}
            title="Nothing waiting here"
            description="You’re all caught up. New items show up when people submit documents."
            action={show === "open" ? <Button variant="secondary" onClick={() => setShow("done")}>Show completed</Button> : undefined}
          />
        }
      />
      {target && (
        <ReviewModal
          key={target.id}
          item={target}
          m={m}
          onClose={() => set({ item: null })}
          onDone={(id) => {
            const next = rows.find((r) => r.id !== id && open(r));
            set({ item: next?.id ?? null });
          }}
        />
      )}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        size="sm"
        title={`Approve ${selected.length} items?`}
        description="People will be told straight away."
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={a.busy === "bulk"}
              onClick={() =>
                void (async () => {
                  let res: { approved: number; skipped: number } | undefined;
                  const ok = await a.run("bulk", async () => {
                    res = await acts.verification.bulk(selected.map((r) => r.id));
                  }, "Approved the selected items.");
                  if (ok) {
                    setPicked([]);
                    setBulkOpen(false);
                    if (res?.skipped) toast({ title: `${res.skipped} skipped — they need a single review.` });
                  }
                })()
              }
            >
              Approve
            </Button>
          </>
        }
      >
        <span />
      </Modal>
    </AdminPage>
  );
}
