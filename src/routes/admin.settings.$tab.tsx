import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Users, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Modal, NativeSelect, Switch, TextInput, Tooltip } from "@/components/kit";
import { ActionMenu, AdminHeader, AdminPage, ConfirmModal, DataTable, FilterTabs, useAction } from "@/components/admin/kit";
import { ago_, dateShort, useAdminActions, useAdminModel, type AdminUser, type FullStateRule, type Policies } from "@/lib/admin-data";
import { moneyC } from "@/lib/format";
import { platformFee } from "@/lib/finance";
import { useCurrentUser } from "@/lib/session";

export const Route = createFileRoute("/admin/settings/$tab")({
  head: () => ({ meta: [{ title: "Settings · Admin · OwnerFi" }] }),
  component: Settings,
});

const TABS = [
  { id: "fees", label: "Fees" },
  { id: "state-rules", label: "State rules" },
  { id: "policies", label: "Policies" },
  { id: "team", label: "Team" },
];
const STATE_NAME: Record<string, string> = { AZ: "Arizona", TX: "Texas", FL: "Florida", CA: "California", NY: "New York", other: "Other states" };
const ROLE = { owner: "Owner", admin: "Admin", support: "Support" } as const;
const ROLE_NOTE = { owner: "Runs the account and the team.", admin: "Manages users, cars, deals and money.", support: "Answers tickets and looks things up." } as const;

function SaveBar({ dirty, busy, error, disabled, onSave, onDiscard }: { dirty: boolean; busy: boolean; error?: string | undefined; disabled?: boolean | undefined; onSave: () => void; onDiscard: () => void }) {
  return (
    <div className="mt-6 space-y-3 border-t border-ink/10 pt-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={busy} disabled={!dirty || disabled} onClick={onSave}>
          Save changes
        </Button>
        <Button variant="secondary" disabled={!dirty || busy} onClick={onDiscard}>
          Discard
        </Button>
        {dirty && <p className="text-sm text-muted">You have unsaved changes.</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- fees */

function Waivers() {
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const [ending, setEnding] = useState<AdminUser | undefined>();
  const [pick, setPick] = useState("");
  const waived = m.users.filter((u) => u.role === "seller" && u.feeWaived);
  const cands = m.users.filter((u) => u.role === "seller" && !u.feeWaived && u.status === "active");
  return (
    <Card>
      <CardHeader title="Beta fee waivers" description="Sellers who pay no fee during the beta." />
      {waived.length === 0 ? (
        <EmptyState icon={<Users aria-hidden className="h-6 w-6" />} title="No sellers are on the beta waiver" description="Add a seller below to waive their fee." />
      ) : (
        <ul className="divide-y divide-ink/10">
          {waived.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="font-semibold">{u.name}</p>
                <p className="text-sm text-muted">{STATE_NAME[u.state] ?? u.state}</p>
              </div>
              <Switch checked label="Fee waived" onChange={() => setEnding(u)} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <NativeSelect label="Add a seller" className="sm:w-72" value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: "", label: "Search sellers" }, ...cands.map((u) => ({ value: u.id, label: u.name }))]} />
        <Button variant="secondary" disabled={!pick} loading={a.busy === "add"} onClick={() => { const u = cands.find((x) => x.id === pick); if (u) void a.run("add", () => acts.users.setFeeWaiver(u, true), "Waiver added.").then((ok) => ok && setPick("")); }}>
          Waive fee
        </Button>
      </div>
      <ConfirmModal open={!!ending} title="End this waiver?" body={`${ending?.name ?? "This seller"} will pay the fee from their next down payment. Down payments already paid don’t change.`} confirmLabel="Charge the fee" busy={a.busy === "end"} error={a.error} onClose={() => { setEnding(undefined); a.clearError(); }} onConfirm={() => ending && void a.run("end", () => acts.users.setFeeWaiver(ending, false), "Waiver ended.").then((ok) => ok && setEnding(undefined))} />
    </Card>
  );
}

const fmtRate = (r: number) => String(+(r * 100).toFixed(2));

function FeeCard({ rate, onDirty }: { rate: number; onDirty: (d: boolean) => void }) {
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const [v, setV] = useState(fmtRate(rate));
  const n = Number(v);
  const ok = v.trim() !== "" && n >= 0 && n <= 25;
  const dirty = v !== fmtRate(rate);
  const change = (x: string) => {
    setV(x);
    onDirty(x !== fmtRate(rate));
  };
  return (
    <Card className="max-w-xl">
      <CardHeader title="OwnerFi fee" />
      <TextInput label="Fee, % of the down payment" type="number" inputMode="decimal" min={0} max={25} step={0.5} value={v} onChange={(e) => change(e.target.value)} error={ok ? undefined : "Enter a fee from 0% to 25%."} helper="Taken from the seller’s side when the buyer pays the down payment. Monthly payments never have a fee." />
      {ok && (
        <p className="mt-3 text-sm">
          On a {moneyC(330000)} down payment the fee is <strong>{moneyC(platformFee(330000, { rate: n / 100 }))}</strong>.
        </p>
      )}
      {dirty && ok && n !== 10 && <Alert tone="warning" className="mt-3">Only new down payments use the new rate. Deals that already paid keep their fee.</Alert>}
      <SaveBar dirty={dirty} disabled={!ok} busy={a.busy === "save"} error={a.error} onSave={() => void a.run("save", () => acts.settings.saveFees(n / 100), "Fee saved.").then((x) => x && onDirty(false))} onDiscard={() => change(fmtRate(rate))} />
    </Card>
  );
}

const dollars = (cents: number) => String(+(cents / 100).toFixed(2));

function InspectionFeeCard({ cents, onDirty }: { cents: number; onDirty: (d: boolean) => void }) {
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const [v, setV] = useState(dollars(cents));
  const n = Number(v);
  const ok = v.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 1000;
  const dirty = v !== dollars(cents);
  const change = (x: string) => {
    setV(x);
    onDirty(x !== dollars(cents));
  };
  return (
    <Card className="max-w-xl">
      <CardHeader title="Inspection price" />
      <TextInput label="Price for the buyer, in dollars" type="number" inputMode="decimal" min={0} max={1000} step={1} value={v} onChange={(e) => change(e.target.value)} error={ok ? undefined : "Enter a price from $0 to $1,000."} helper="The buyer sees this when they book an inspection and pays it themselves. Default $99." />
      {dirty && ok && <Alert tone="warning" className="mt-3">Only new bookings use the new price. Inspections already booked keep theirs.</Alert>}
      <SaveBar dirty={dirty} disabled={!ok} busy={a.busy === "save"} error={a.error} onSave={() => void a.run("save", () => acts.settings.saveInspectionFee(Math.round(n * 100)), "Inspection price saved.").then((x) => x && onDirty(false))} onDiscard={() => change(dollars(cents))} />
    </Card>
  );
}

/* ------------------------------------------------------------ state rules */

function RuleForm({ rule, busy, error, onSave, onClose }: { rule: FullStateRule; busy: boolean; error?: string | undefined; onSave: (p: Omit<FullStateRule, "state">) => void; onClose: () => void }) {
  const [apr, setApr] = useState(String(rule.maxApr));
  const [limit, setLimit] = useState(String(rule.annualSaleLimit));
  const [disc, setDisc] = useState(rule.disclosures);
  const [add, setAdd] = useState("");
  const push = () => {
    const t = add.trim();
    if (t && !disc.includes(t)) setDisc([...disc, t]);
    setAdd("");
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Max interest rate (%)" type="number" inputMode="decimal" value={apr} onChange={(e) => setApr(e.target.value)} />
        <TextInput label="Cars a seller can sell per year" type="number" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Required disclosures</p>
        <ul className="mb-3 flex flex-wrap gap-2">
          {disc.map((d) => (
            <li key={d} className="inline-flex items-center gap-1 rounded-full bg-ink/10 py-1 pl-3 pr-1 text-sm">
              {d}
              <button type="button" aria-label={`Remove ${d}`} onClick={() => setDisc(disc.filter((x) => x !== d))} className="rounded-full p-1 hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <div className="flex-1">
            <TextInput label="Add a disclosure" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); push(); } }} />
          </div>
          <Button variant="secondary" className="self-end" onClick={push}>
            Add
          </Button>
        </div>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={() => onSave({ maxApr: Number(apr), annualSaleLimit: Number(limit), disclosures: disc })}>
          Save rules
        </Button>
      </div>
    </div>
  );
}

function StateRules() {
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const [edit, setEdit] = useState<FullStateRule | undefined>();
  const close = () => {
    setEdit(undefined);
    a.clearError();
  };
  return (
    <div className="space-y-4">
      <Alert tone="info">These are example values. Check them with a lawyer before launch.</Alert>
      <Card className="p-0">
        <DataTable<FullStateRule>
          caption="State rules"
          rows={m.s.stateRules}
          getRowId={(r) => r.state}
          columns={[
            { key: "state", header: "State", render: (r) => (r.state === "other" ? "Other states" : `${STATE_NAME[r.state] ?? r.state} (${r.state})`) },
            { key: "apr", header: "Max interest rate", align: "right", render: (r) => `${r.maxApr.toFixed(1)}%` },
            { key: "limit", header: "Cars per seller, per year", align: "right", render: (r) => r.annualSaleLimit },
            { key: "disc", header: "Disclosures", render: (r) => <Tooltip content={r.disclosures.join(" · ")}><span tabIndex={0} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Badge>{r.disclosures.length} required</Badge></span></Tooltip> },
            { key: "edit", header: "", align: "right", render: (r) => <Button variant="ghost" size="sm" aria-label={`Edit ${STATE_NAME[r.state] ?? r.state} rules`} onClick={() => setEdit(r)}>Edit</Button> },
          ]}
        />
      </Card>
      <Modal open={!!edit} onClose={close} title={edit ? `${STATE_NAME[edit.state] ?? edit.state} rules` : ""}>
        {edit && <RuleForm key={edit.state} rule={edit} busy={a.busy === "rule"} error={a.error} onClose={close} onSave={(p) => void a.run("rule", () => acts.settings.saveStateRule(edit.state, p), "Rules saved.").then((ok) => ok && close())} />}
      </Modal>
    </div>
  );
}

/* --------------------------------------------------------------- policies */

const toForm = (p: Policies) => ({ cancel: String(p.testDriveCancelHours), rounds: String(p.maxCounterRounds), reminder: String(p.late.reminderDay), notice: String(p.late.noticeDay), seller: String(p.late.sellerAlertDay), def: String(p.late.defaultDay) });
const fromForm = (f: ReturnType<typeof toForm>): Policies => ({ testDriveCancelHours: Number(f.cancel), maxCounterRounds: Number(f.rounds), late: { reminderDay: Number(f.reminder), noticeDay: Number(f.notice), sellerAlertDay: Number(f.seller), defaultDay: Number(f.def) } });
function policyError(p: Policies) {
  const l = p.late;
  const nums = [p.testDriveCancelHours, p.maxCounterRounds, l.reminderDay, l.noticeDay, l.sellerAlertDay, l.defaultDay];
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return "Enter whole numbers from 0.";
  if (!Number.isInteger(p.maxCounterRounds) || p.maxCounterRounds < 1) return "Counter-offer rounds has to be at least 1.";
  if (!(l.reminderDay < l.noticeDay && l.noticeDay < l.sellerAlertDay && l.sellerAlertDay < l.defaultDay)) return "The days have to go in order: reminder, notice, seller alert, default.";
  return "";
}

function PoliciesCard({ initial, onDirty }: { initial: Policies; onDirty: (d: boolean) => void }) {
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const base = toForm(initial);
  const [f, setF] = useState(base);
  const dirty = JSON.stringify(f) !== JSON.stringify(base);
  const err = policyError(fromForm(f));
  const set = (k: keyof typeof f, v: string) => {
    const n = { ...f, [k]: v };
    setF(n);
    onDirty(JSON.stringify(n) !== JSON.stringify(base));
  };
  const field = (k: keyof typeof f, label: string, helper?: string) => <TextInput label={label} type="number" inputMode="numeric" value={f[k]} onChange={(e) => set(k, e.target.value)} {...(helper ? { helper } : {})} />;
  const late = fromForm(f).late;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Test drives and offers" />
        <div className="grid gap-4 sm:grid-cols-2">
          {field("cancel", "Free-cancel window (hours)", "Buyers can cancel for free until this long before the drive.")}
          {field("rounds", "Counter-offer rounds", "How many times the seller and buyer can counter.")}
        </div>
        <h3 className="mb-3 mt-6 text-lg font-semibold">When a payment is late</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("reminder", "Reminder, day")}
          {field("notice", "Late notice, day")}
          {field("seller", "Seller alert, day")}
          {field("def", "Default options open, day")}
        </div>
        {err && dirty && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
        <SaveBar dirty={dirty} disabled={!!err} busy={a.busy === "save"} error={a.error} onSave={() => void a.run("save", () => acts.settings.savePolicies(fromForm(f)), "Policies saved.").then((ok) => ok && onDirty(false))} onDiscard={() => { setF(base); onDirty(false); }} />
      </Card>
      <Card>
        <CardHeader title="What a buyer sees" description="The late-payment timeline." />
        <ol className="space-y-2 text-sm">
          <li>Day {late.reminderDay} — a friendly reminder</li>
          <li>Day {late.noticeDay} — a late notice</li>
          <li>Day {late.sellerAlertDay} — the seller is told</li>
          <li>Day {late.defaultDay} — default options open</li>
        </ol>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------- team */

function Team() {
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const [dlg, setDlg] = useState<{ kind: "invite" } | { kind: "role"; user: AdminUser } | { kind: "remove"; user: AdminUser } | { kind: "cancel"; id: string } | undefined>();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "support">("admin");
  const meId = useCurrentId();
  const members = m.users.filter((u) => u.role === "admin");
  const owners = members.filter((u) => u.adminRole === "owner").length;
  const rows: ({ id: string; kind: "member"; user: AdminUser } | { id: string; kind: "invite"; invite: (typeof m.s.invites)[number] })[] = [
    ...members.map((u) => ({ id: u.id, kind: "member" as const, user: u })),
    ...m.s.invites.map((i) => ({ id: i.id, kind: "invite" as const, invite: i })),
  ];
  const close = () => {
    setDlg(undefined);
    setEmail("");
    a.clearError();
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setRole("admin"); setDlg({ kind: "invite" }); }}>Invite admin</Button>
      </div>
      <Card className="p-0">
        <DataTable
          caption="Team"
          rows={rows}
          getRowId={(r) => r.id}
          columns={[
            { key: "who", header: "Name", render: (r) => r.kind === "member" ? (<div><p className="font-semibold">{r.user.name}{r.user.id === meId && <span className="font-normal text-muted"> (you)</span>}</p><p className="text-xs text-muted">{r.user.email}</p></div>) : (<div><p className="font-semibold">{r.invite.email}</p><p className="text-xs text-muted">Invited {dateShort(r.invite.invitedAt)}</p></div>) },
            { key: "role", header: "Role", render: (r) => <Badge tone="primary">{ROLE[r.kind === "member" ? (r.user.adminRole ?? "admin") : r.invite.role]}</Badge> },
            { key: "state", header: "Status", render: (r) => (r.kind === "invite" ? <Badge tone="warning">Invited</Badge> : <Badge tone={r.user.twoFactor ? "success" : "warning"}>{r.user.twoFactor ? "2FA on" : "2FA off"}</Badge>) },
            { key: "active", header: "Last active", render: (r) => (r.kind === "member" && r.user.lastActiveAt ? ago_(r.user.lastActiveAt) : "—") },
            {
              key: "menu",
              header: "",
              align: "right",
              render: (r) => {
                if (r.kind === "invite") return <Button variant="ghost" size="sm" onClick={() => setDlg({ kind: "cancel", id: r.invite.id })}>Cancel invite</Button>;
                const lastOwner = r.user.adminRole === "owner" && owners < 2;
                const lock = r.user.id === meId ? "You can’t remove yourself." : lastOwner ? "There must be at least one Owner." : "";
                return (
                  <div className="flex items-center justify-end gap-1">
                    {lock && <Tooltip content={lock}><span tabIndex={0} className="rounded text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Locked</span></Tooltip>}
                    <ActionMenu triggerLabel={`Actions for ${r.user.name}`} trigger={<MoreHorizontal aria-hidden className="h-5 w-5" />} items={[{ label: "Change role", onSelect: () => { setRole(r.user.adminRole ?? "admin"); setDlg({ kind: "role", user: r.user }); } }, ...(lock ? [] : [{ label: "Remove", danger: true, onSelect: () => setDlg({ kind: "remove", user: r.user }) }])]} />
                  </div>
                );
              },
            },
          ]}
        />
      </Card>
      <Modal
        open={dlg?.kind === "invite" || dlg?.kind === "role"}
        onClose={close}
        size="sm"
        title={dlg?.kind === "invite" ? "Invite an admin" : "Change role"}
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button loading={!!a.busy} onClick={() => void a.run("role", () => (dlg?.kind === "role" ? acts.settings.setRole(dlg.user.id, role) : acts.settings.invite(email, role)), dlg?.kind === "role" ? "Role changed." : "Invite sent.").then((ok) => ok && close())}>
              {dlg?.kind === "invite" ? "Send invite" : "Save role"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {dlg?.kind === "invite" && <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          {dlg?.kind === "role" && <p>{dlg.user.name}</p>}
          <div role="radiogroup" aria-label="Role" className="space-y-2">
            {(["owner", "admin", "support"] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={`flex w-full flex-col rounded-xl border px-3 py-2.5 text-left ${role === r ? "border-primary bg-primary/10" : "border-ink/15 hover:border-ink/30"}`}>
                <span className="font-semibold">{ROLE[r]}</span>
                <span className="text-sm text-muted">{ROLE_NOTE[r]}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">Roles are labels for now. They don’t limit what anyone can do.</p>
          {a.error && <Alert tone="danger">{a.error}</Alert>}
        </div>
      </Modal>
      <ConfirmModal open={dlg?.kind === "remove"} title="Remove this admin?" body={`${dlg?.kind === "remove" ? dlg.user.name : ""} loses access right away.`} confirmLabel="Remove" tone="danger" busy={!!a.busy} error={a.error} onClose={close} onConfirm={() => dlg?.kind === "remove" && void a.run("rm", () => acts.settings.removeAdmin(dlg.user.id), "Admin removed.").then((ok) => ok && close())} />
      <ConfirmModal open={dlg?.kind === "cancel"} title="Cancel this invite?" body="The link in the email stops working." confirmLabel="Cancel invite" tone="danger" busy={!!a.busy} error={a.error} onClose={close} onConfirm={() => dlg?.kind === "cancel" && void a.run("ci", () => acts.settings.cancelInvite(dlg.id), "Invite cancelled.").then((ok) => ok && close())} />
    </div>
  );
}

const useCurrentId = () => useCurrentUser()?.id;

/* ------------------------------------------------------------------- page */

function Settings() {
  const { tab } = Route.useParams();
  const navigate = useNavigate();
  const m = useAdminModel();
  const [dirty, setDirty] = useState(false);
  const [leave, setLeave] = useState<string | undefined>();
  if (!TABS.some((t) => t.id === tab)) return <Navigate to="/admin/settings/$tab" params={{ tab: "fees" }} replace />;
  const go = (id: string) => {
    if (dirty) setLeave(id);
    else navigate({ to: "/admin/settings/$tab", params: { tab: id } });
  };
  let body: ReactNode = null;
  if (tab === "fees")
    body = (
      <div className="space-y-6">
        <FeeCard key={m.s.feeRate} rate={m.s.feeRate} onDirty={setDirty} />
        <InspectionFeeCard key={m.s.inspectionFeeCents ?? 9_900} cents={m.s.inspectionFeeCents ?? 9_900} onDirty={setDirty} />
        <Waivers />
      </div>
    );
  if (tab === "state-rules") body = <StateRules />;
  if (tab === "policies") body = <PoliciesCard key={JSON.stringify(m.s.policies)} initial={m.s.policies} onDirty={setDirty} />;
  if (tab === "team") body = <Team />;
  return (
    <AdminPage narrow>
      <AdminHeader title="Settings" description="The rules OwnerFi runs by." />
      <FilterTabs idPrefix="settings" value={tab} onChange={go} items={TABS} />
      <div className="pt-4" role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-${tab}`}>
        {body}
      </div>
      <ConfirmModal
        open={!!leave}
        title="Leave without saving?"
        body="Your changes will be lost."
        confirmLabel="Leave"
        tone="danger"
        onClose={() => setLeave(undefined)}
        onConfirm={() => {
          const id = leave!;
          setLeave(undefined);
          setDirty(false);
          navigate({ to: "/admin/settings/$tab", params: { tab: id } });
        }}
      />
    </AdminPage>
  );
}
