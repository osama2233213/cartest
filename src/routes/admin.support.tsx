import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Search } from "lucide-react";
import { useState } from "react";
import { Alert, AppLink, Badge, Button, EmptyState, Modal, NativeSelect, TextArea, TextInput } from "@/components/kit";
import { AdminHeader, AdminPage, DataTable, FilterBar, KpiCard, anySearch, useAction, useUrlParams } from "@/components/admin/kit";
import { StatusChip } from "@/components/status";
import { ago_, useAdminActions, useAdminModel, type AdminModel, type Ticket } from "@/lib/admin-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/support")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Support · Admin · OwnerFi" }] }),
  component: Support,
});

const STATUSES = ["open", "waiting", "solved"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const STATUS_LABEL = { open: "Open", waiting: "Waiting on user", solved: "Solved" } as const;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function TicketModal({ t, m, onClose }: { t: Ticket; m: AdminModel; onClose: () => void }) {
  const acts = useAdminActions(m);
  const a = useAction();
  const [text, setText] = useState("");
  const user = m.users.find((u) => u.id === t.userId);
  const solved = t.status === "solved";
  const admins = m.users.filter((u) => u.role === "admin");
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={t.subject}
      footer={
        solved ? (
          <Button variant="secondary" loading={a.busy === "reopen"} onClick={() => void a.run("reopen", () => acts.support.reopen(t.id), "Ticket reopened.")}>
            Reopen
          </Button>
        ) : (
          <>
            <Button variant="secondary" loading={a.busy === "solve"} onClick={() => void a.run("solve", () => acts.support.solve(t.id), "Marked as solved.")}>
              Mark solved
            </Button>
            <Button loading={a.busy === "reply"} disabled={!text.trim()} onClick={() => void a.run("reply", () => acts.support.reply(t.id, text), "Reply sent. They were told.").then((ok) => ok && setText(""))}>
              Send reply
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip kind="ticket" value={t.status} />
          <StatusChip kind="ticketPriority" value={t.priority} />
          <span className="text-sm capitalize text-muted">
            {user?.name ?? "Unknown"} · {user?.role}
          </span>
          {t.dealId && (
            <AppLink to={`/admin/deals/${t.dealId}`} className="rounded text-sm font-semibold text-primary hover:underline">
              Deal {t.dealId}
            </AppLink>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NativeSelect label="Assigned to" value={t.assigneeId ?? ""} onChange={(e) => void a.run("assign", () => acts.support.assign(t.id, e.target.value || null), "Assigned.")} options={[{ value: "", label: "Nobody" }, ...admins.map((u) => ({ value: u.id, label: u.name }))]} />
          <NativeSelect label="Priority" value={t.priority} onChange={(e) => void a.run("prio", () => acts.support.priority(t.id, e.target.value as Ticket["priority"]), "Priority changed.")} options={PRIORITIES.map((p) => ({ value: p, label: cap(p) }))} />
        </div>
        <ol aria-label="Conversation" className="space-y-3">
          {t.messages.map((msg) => (
            <li key={msg.id} className={cn("max-w-[85%] rounded-2xl p-3 text-sm", msg.from === "admin" ? "ml-auto bg-primary/10" : "bg-surface")}>
              <p>{msg.text}</p>
              <p className="mt-1 text-xs text-muted">
                {msg.from === "admin" ? "OwnerFi" : (user?.name ?? "User")} · {ago_(msg.at)}
              </p>
            </li>
          ))}
        </ol>
        {!solved && <TextArea label="Your reply" helper="They get a notification. Keep it short and say what happens next." value={text} onChange={(e) => setText(e.target.value)} />}
        {a.error && <Alert tone="danger">{a.error}</Alert>}
      </div>
    </Modal>
  );
}

function Support() {
  const m = useAdminModel();
  const { params, set, clear } = useUrlParams();
  const status = STATUSES.find((s) => s === params.get("status")) ?? "all";
  const priority = PRIORITIES.find((p) => p === params.get("priority")) ?? "all";
  const q = params.get("q") ?? "";
  const id = params.get("id");
  const tickets = m.s.tickets;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const urgent = tickets.filter((t) => t.priority === "urgent" && t.status !== "solved").length;
  const user = (t: Ticket) => m.users.find((u) => u.id === t.userId);
  const rows = tickets
    .filter((t) => status === "all" || t.status === status)
    .filter((t) => priority === "all" || t.priority === priority)
    .filter((t) => !q || `${t.subject} ${user(t)?.name ?? ""} ${t.dealId ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const picked = id ? tickets.find((t) => t.id === id) : undefined;
  const filtering = status !== "all" || priority !== "all" || q !== "";
  const who = (t: Ticket) => (user(t) ? `${user(t)!.name} · ${user(t)!.role}` : "Unknown");
  const assignee = (t: Ticket) => m.users.find((u) => u.id === t.assigneeId)?.name;

  return (
    <AdminPage>
      <AdminHeader title="Support" description="Questions from sellers and buyers. Answer the urgent ones first." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open" value={tickets.filter((t) => t.status === "open").length} />
        <KpiCard label="Waiting on user" value={tickets.filter((t) => t.status === "waiting").length} />
        <KpiCard label="Solved this week" value={tickets.filter((t) => t.status === "solved" && (t.solvedAt ?? "") >= weekAgo).length} />
        <KpiCard label="Urgent" value={urgent} hint={urgent ? "Look at these first" : "Nothing urgent"} />
      </div>
      <FilterBar>
        <TextInput aria-label="Search" size="sm" value={q} onChange={(e) => set({ q: e.target.value })} placeholder="Subject, person or deal" wrapperClassName="w-full sm:w-72" leftAdornment={<Search aria-hidden className="h-4 w-4" />} />
        <NativeSelect aria-label="Status" size="sm" className="sm:w-44" value={status} onChange={(e) => set({ status: e.target.value === "all" ? null : e.target.value })} options={[{ value: "all", label: "Any status" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} />
        <NativeSelect aria-label="Priority" size="sm" className="sm:w-40" value={priority} onChange={(e) => set({ priority: e.target.value === "all" ? null : e.target.value })} options={[{ value: "all", label: "Any priority" }, ...PRIORITIES.map((p) => ({ value: p, label: cap(p) }))]} />
      </FilterBar>
      <DataTable<Ticket>
        caption="Support tickets"
        rows={rows}
        getRowId={(t) => t.id}
        columns={[
          { key: "subject", header: "Subject", render: (t) => <button type="button" onClick={() => set({ id: t.id })} className="rounded text-left font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t.subject}</button> },
          { key: "from", header: "From", render: (t) => <span className="capitalize">{who(t)}</span> },
          { key: "priority", header: "Priority", render: (t) => <StatusChip kind="ticketPriority" value={t.priority} /> },
          { key: "status", header: "Status", render: (t) => <StatusChip kind="ticket" value={t.status} /> },
          { key: "deal", header: "Deal", render: (t) => (t.dealId ? <AppLink to={`/admin/deals/${t.dealId}`} className="rounded font-semibold hover:underline">{t.dealId}</AppLink> : "—") },
          { key: "assignee", header: "Assigned to", render: (t) => assignee(t) ?? <Badge>Nobody</Badge> },
          { key: "updated", header: "Updated", render: (t) => ago_(t.updatedAt) },
        ]}
        mobileCard={(t) => (
          <button type="button" onClick={() => set({ id: t.id })} className="w-full space-y-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <p className="font-semibold">{t.subject}</p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip kind="ticketPriority" value={t.priority} />
              <StatusChip kind="ticket" value={t.status} />
            </div>
            <p className="text-sm text-muted">
              <span className="capitalize">{who(t)}</span> · {ago_(t.updatedAt)}
            </p>
          </button>
        )}
        emptyState={<EmptyState icon={<LifeBuoy aria-hidden className="h-6 w-6" />} title={filtering ? "No tickets match" : "No tickets"} description={filtering ? "Try a different status, priority or search." : "When someone asks for help it will show up here."} action={filtering ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} />}
      />
      {picked && <TicketModal key={picked.id} t={picked} m={m} onClose={() => set({ id: null })} />}
    </AdminPage>
  );
}
