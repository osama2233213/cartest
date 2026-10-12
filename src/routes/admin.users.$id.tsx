import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Eye, KeyRound, MoreHorizontal, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { Alert, AppLink, Avatar, Badge, Button, Card, CardHeader, EmptyState, Modal, NativeSelect, Switch, TextArea } from "@/components/kit";
import { ActionMenu, AdminPage, ConfirmModal, DetailSection, SummaryFacts, useAction } from "@/components/admin/kit";
import { CarImage } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { ago_, dateShort, firstName, userStatus, vehicleName, useAdminActions, useAdminModel, type AdminUser } from "@/lib/admin-data";
import { moneyC, shortCar } from "@/lib/format";
import { auth } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/users/$id")({
  head: () => ({ meta: [{ title: "Person · Admin · OwnerFi" }] }),
  component: UserDetail,
});

const REASONS = ["Suspected fraud", "Fake documents", "Harassment", "Chargebacks", "Terms violation", "Other"];

const Back = () => (
  <AppLink to="/admin/users" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
    <ArrowLeft aria-hidden className="h-4 w-4" /> All users
  </AppLink>
);

function SuspendModal({ user, onClose, a }: { user: AdminUser; onClose: () => void; a: ReturnType<typeof useAction> & { suspend: (reason: string, note: string) => Promise<boolean> } }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  return (
    <ConfirmShell
      title={`Suspend ${firstName(user)}?`}
      body={user.role === "seller" ? "They won’t be able to sign in, and their cars come off the marketplace." : "They won’t be able to sign in until you reinstate them."}
      confirm={`Suspend ${firstName(user)}`}
      disabled={!reason}
      busy={!!a.busy}
      error={a.error}
      onClose={onClose}
      onConfirm={() => void a.suspend(reason, note).then((ok) => ok && onClose())}
    >
      <NativeSelect label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={[{ value: "", label: "Pick a reason" }, ...REASONS.map((r) => ({ value: r, label: r }))]} />
      <TextArea label="Note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
    </ConfirmShell>
  );
}

function ConfirmShell({ title, body, confirm, disabled, busy, error, onClose, onConfirm, children }: { title: string; body: string; confirm: string; disabled?: boolean; busy: boolean; error?: string | undefined; onClose: () => void; onConfirm: () => void; children: React.ReactNode }) {
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={title}
      description={body}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} disabled={disabled} onClick={onConfirm}>
            {confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {children}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

function RiskCard({ user }: { user: AdminUser }) {
  const rows: [string, string][] = [
    ["Credit range", user.creditBand ?? "—"],
    ["Identity", user.verification.identity === "verified" ? "Verified" : "Not verified"],
    ["Bank account", user.verification.bank === "verified" ? "Verified" : "Not verified"],
    ["Credit check", user.verification.credit === "verified" ? "Done" : "Not done"],
  ];
  return (
    <Card>
      <CardHeader title="Risk summary" description="What a seller sees before they accept an offer." />
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function UserDetail() {
  const { id } = Route.useParams();
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const navigate = useNavigate();
  const act = useAction();
  const [dlg, setDlg] = useState<null | "suspend" | "reinstate" | "2fa" | "viewas">(null);
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);
  const user = m.users.find((u) => u.id === id);

  if (!user) {
    return (
      <AdminPage>
        <div className="space-y-4">
          <Back />
          <EmptyState title="We can’t find that person" description="They may have been removed. Go back to the list to find them." action={<Button variant="secondary" onClick={() => history.back()}>Go back</Button>} />
        </div>
      </AdminPage>
    );
  }

  const st = userStatus(user);
  const suspended = user.status === "suspended";
  const isAdmin = user.role === "admin";
  const close = () => {
    setDlg(null);
    act.clearError();
  };
  const myDeals = m.dealRows.filter((r) => (user.role === "seller" ? r.deal.seller : r.deal.buyer) === user.name);
  const cars = m.vehicles.filter((v) => v.sellerName === user.name);
  const payments = m.payments.filter((p) => (user.role === "seller" ? p.sellerName : p.buyerName) === user.name);
  const paymentsShown = showAll || payments.length <= 8 ? payments : payments.slice(0, 6);
  const feesPaid = payments.filter((p) => p.kind === "down_payment" && p.status === "paid").reduce((s, p) => s + p.fee, 0);
  const queueItems = m.s.queue.filter((q) => q.userId === user.id);
  const activity = [
    ...myDeals.map((r) => ({ at: r.updatedAt, text: `${shortCar(r.deal.car)}: ${r.deal.stage.replace(/_/g, " ")}` })),
    ...m.s.audit.filter((e) => e.target.includes(user.name)).map((e) => ({ at: e.at, text: `${e.actor}: ${e.label}` })),
  ]
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 20);

  const facts =
    user.role === "seller"
      ? [
          { label: "Live cars", value: String(cars.filter((c) => c.status === "listed" || c.status === "reserved").length) },
          { label: "Deals", value: String(myDeals.length) },
          { label: "Payments received", value: moneyC(user.received), strong: true },
        ]
      : [
          { label: "Deals", value: String(myDeals.length) },
          { label: "Paid so far", value: moneyC(payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0)), strong: true },
          { label: "Credit", value: user.creditBand ?? "—" },
        ];

  const profile: [string, string][] = [
    ["Email", `${user.email} · verified: ${user.emailVerified ? "Yes" : "No"}`],
    ["Phone", `${user.phone} · verified: ${user.phoneVerified ? "Yes" : "No"}`],
    ["Address", `${user.city}, ${user.state}`],
    ["State", user.state],
    ["Two-step sign-in", user.twoFactor ? "On" : "Off"],
    ...(user.role === "seller" ? ([["OwnerFi fee", user.feeWaived ? "Waived" : "Charged"]] as [string, string][]) : []),
  ];
  const v = user.verification;
  const vrows: [string, string | undefined][] = user.role === "seller" ? [["Identity", v.identity], ["Payouts", v.payouts]] : [["Identity", v.identity], ["Bank", v.bank], ["Credit", v.credit]];
  const QL = { identity: "Identity", bank: "Bank account", title: "Title", vehicle_flag: "Flagged car" } as const;

  return (
    <AdminPage>
      <div className="space-y-5">
        <div className="space-y-3">
          <Back />
          <Card padding="none">
            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
              <Avatar name={user.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold md:text-[28px]">{user.name}</h1>
                  <Badge tone="neutral">{user.role === "seller" ? "Seller" : user.role === "buyer" ? "Buyer" : "Admin"}</Badge>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="mt-1.5 break-words text-sm text-muted">
                  {user.email} · {user.phone} · {user.state} · Joined {dateShort(user.createdAt)}
                </p>
              </div>
              {!isAdmin && (
                <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:self-start">
                  <Button variant="secondary" leftIcon={<Eye aria-hidden className="h-4 w-4" />} onClick={() => setDlg("viewas")}>
                    View as {firstName(user)}
                  </Button>
                  <ActionMenu
                    triggerLabel="More actions"
                    trigger={
                      <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink/15 bg-white px-4 text-[15px] font-semibold shadow-card hover:bg-surface">
                        <MoreHorizontal aria-hidden className="h-4 w-4" /> Actions
                      </span>
                    }
                    items={[
                      suspended ? { label: "Reinstate", icon: <UserCheck className="h-4 w-4" />, onSelect: () => setDlg("reinstate") } : { label: "Suspend", icon: <UserX className="h-4 w-4" />, danger: true, onSelect: () => setDlg("suspend") },
                      { label: "Reset two-step sign-in", icon: <KeyRound className="h-4 w-4" />, onSelect: () => setDlg("2fa") },
                    ]}
                  />
                </div>
              )}
            </div>
            {!isAdmin && (
              <div className="border-t border-ink/[0.08] bg-surface/60 px-5 py-4 md:px-6">
                <SummaryFacts facts={facts} />
              </div>
            )}
          </Card>
          {suspended && (
            <Alert tone="danger">
              {firstName(user)} is suspended. They can’t sign in until you reinstate them.
              {user.suspendedReason && ` Reason: ${user.suspendedReason}.`}
              {user.suspendedAt && ` Since ${dateShort(user.suspendedAt)}.`}
            </Alert>
          )}
        </div>

        <div className={cn("grid items-start gap-5", !isAdmin && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
          <div className="min-w-0 space-y-5">
            <DetailSection id="user-profile" title="Profile">
              <dl className="divide-y divide-ink/10 text-sm">
                {profile.map(([k, val]) => (
                  <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0">
                    <dt className="text-muted">{k}</dt>
                    <dd className="min-w-0 break-words text-right font-medium">{val}</dd>
                  </div>
                ))}
              </dl>
            </DetailSection>
            {!isAdmin && (
              <>
                {user.role === "seller" && (
                  <DetailSection id="user-cars" title="Cars" count={cars.length}>
                    {cars.length === 0 ? (
                      <p className="text-muted">No cars yet.</p>
                    ) : (
                      <ul className="-my-1 space-y-1">
                        {cars.map((c) => (
                          <li key={c.id}>
                            <AppLink to={`/admin/vehicles/${c.id}`} className="-mx-3 flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface">
                              <CarImage src={c.photos[0]} alt="" make={c.make} model={c.model} className="h-10 w-14 shrink-0 !rounded-lg" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">{vehicleName(c)}</span>
                                <span className="num block text-sm text-muted">{moneyC(c.asking)}</span>
                              </span>
                              <StatusChip kind="vehicle" value={c.status} />
                              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                            </AppLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DetailSection>
                )}
                <DetailSection id="user-deals" title="Deals" count={myDeals.length}>
                  {myDeals.length === 0 ? (
                    <p className="text-muted">No deals yet.</p>
                  ) : (
                    <ul className="-my-1 space-y-1">
                      {myDeals.map((r) => (
                        <li key={r.id}>
                          <AppLink to={`/admin/deals/${r.id}`} className="-mx-3 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{shortCar(r.deal.car)}</span>
                              <span className="block text-sm text-muted">
                                with {user.role === "seller" ? r.deal.buyer : r.deal.seller} · updated {r.deal.updated}
                              </span>
                            </span>
                            <StatusChip kind="deal" value={r.deal.stage} />
                            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                          </AppLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </DetailSection>
                <DetailSection id="user-money" title="Money" count={payments.length} description={user.role === "seller" && user.feeWaived ? "OwnerFi fee is waived for this seller." : undefined}>
                  {user.role === "seller" && (
                    <p className="mb-4 rounded-xl bg-surface px-4 py-3 text-sm text-muted">
                      OwnerFi fees paid: <span className="num font-semibold text-ink">{moneyC(feesPaid)}</span> · Payouts: <span className="num font-semibold text-ink">{payments.filter((p) => p.status === "paid").length}</span>
                    </p>
                  )}
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted">Payments</h3>
                  {payments.length === 0 ? (
                    <p className="py-4 text-muted">No payments yet.</p>
                  ) : (
                    <>
                      <ul className="divide-y divide-ink/10">
                        {paymentsShown.map((p) => (
                          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 last:pb-0">
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">{p.kind === "down_payment" ? "Down payment" : "Monthly payment"}</span>
                              <span className="block text-sm text-muted">{dateShort(p.paidAt ?? p.dueAt)}</span>
                            </span>
                            <span className="num font-semibold">{moneyC(p.amount)}</span>
                            <StatusChip kind="payment" value={p.status} />
                          </li>
                        ))}
                      </ul>
                      {payments.length > 8 && (
                        <button type="button" aria-expanded={showAll} onClick={() => setShowAll((x) => !x)} className="mt-3 rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-primary-50">
                          {showAll ? "Show fewer" : `Show all ${payments.length} payments`}
                        </button>
                      )}
                    </>
                  )}
                </DetailSection>
                <DetailSection id="user-verification" title="Verification history" description="Everything they sent us to check." count={queueItems.length}>
                  {queueItems.length === 0 ? (
                    <p className="text-muted">Nothing has been sent in yet.</p>
                  ) : (
                    <ul className="divide-y divide-ink/10">
                      {queueItems.map((q) => (
                        <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {QL[q.type]}
                              {q.scope ? " (credit)" : ""}
                            </p>
                            <p className="text-sm text-muted">
                              Sent {ago_(q.submittedAt)}
                              {q.decidedBy && ` · decided by ${q.decidedBy}`}
                              {q.reason && ` · ${q.reason}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusChip kind="verification" value={q.status} />
                            <AppLink to={`/admin/verifications?item=${q.id}`} className="text-sm font-semibold text-primary hover:underline">
                              Open in queue
                            </AppLink>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </DetailSection>
                <DetailSection id="user-activity" title="Recent activity">
                  {activity.length === 0 ? (
                    <p className="text-muted">Nothing yet.</p>
                  ) : (
                    <ol className="space-y-3 border-l-2 border-primary/20 pl-4">
                      {activity.map((e, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="w-24 shrink-0 text-muted">{ago_(e.at)}</span>
                          <span className="min-w-0">{e.text}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </DetailSection>
                <DetailSection id="user-notes" title="Notes" description="Only the team can see notes." count={user.adminNotes.length}>
                  <div className="divide-y divide-ink/10">
                    <div className="pb-5">
                      <TextArea label="Add a note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
                      {act.error && !dlg && <Alert tone="danger" className="mt-3">{act.error}</Alert>}
                      <Button className="mt-3" loading={act.busy === "note"} disabled={note.trim().length < 3} onClick={() => void act.run("note", () => acts.users.addNote(user, note), "Note saved.").then((ok) => ok && setNote(""))}>
                        Save note
                      </Button>
                    </div>
                    <div className="min-w-0 pt-5">
                      {user.adminNotes.length === 0 ? (
                        <p className="text-muted">No notes yet. Notes are only visible to the team.</p>
                      ) : (
                        <ul className="space-y-4">
                          {user.adminNotes.map((n) => (
                            <li key={n.id} className="border-l-2 border-primary/25 pl-3">
                              <p>{n.text}</p>
                              <p className="text-sm text-muted">
                                {n.by} · {ago_(n.at)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </DetailSection>
              </>
            )}
          </div>
          {!isAdmin && (
            <aside className="min-w-0 space-y-5 xl:sticky xl:top-24" aria-label="At a glance">
              <Card>
                <CardHeader title="Where they are" description="Verification steps." />
                <ul className="divide-y divide-ink/10">
                  {vrows.map(([label, val]) => (
                    <li key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                      <span>{label}</span>
                      <StatusChip kind="verification" value={val ?? "not_started"} />
                    </li>
                  ))}
                </ul>
              </Card>
              {user.role === "seller" && (
                <Card>
                  <CardHeader title="OwnerFi fee" />
                  <Switch
                    label="Waive OwnerFi fee"
                    description="No OwnerFi fee on this seller’s next down payments."
                    checked={user.feeWaived}
                    disabled={!!act.busy}
                    onChange={(on) => void act.run("waiver", () => acts.users.setFeeWaiver(user, on), `Fee waiver ${on ? "on" : "off"} for ${firstName(user)}.`)}
                  />
                </Card>
              )}
              {user.role === "buyer" && user.creditBand && <RiskCard user={user} />}
            </aside>
          )}
        </div>
      </div>

      {dlg === "suspend" && <SuspendModal user={user} onClose={close} a={{ ...act, suspend: (reason, n) => act.run("suspend", () => acts.users.suspend(user, reason, n), `${user.name} is suspended.`) }} />}
      <ConfirmModal open={dlg === "reinstate"} title={`Reinstate ${firstName(user)}?`} body="They can sign in again. Paused cars stay paused until they relist." confirmLabel="Reinstate" busy={act.busy === "reinstate"} error={act.error} onClose={close} onConfirm={() => void act.run("reinstate", () => acts.users.reinstate(user), `${user.name} is active again.`).then((ok) => ok && close())} />
      <ConfirmModal open={dlg === "2fa"} title="Reset two-step sign-in?" body="They’ll be asked to set up two-step sign-in again." confirmLabel="Reset" busy={act.busy === "2fa"} error={act.error} onClose={close} onConfirm={() => void act.run("2fa", () => acts.users.reset2fa(user), `Two-step reset for ${user.name}.`).then((ok) => ok && close())} />
      <ConfirmModal
        open={dlg === "viewas"}
        title={`View as ${firstName(user)}?`}
        body={`You’ll see OwnerFi exactly as ${firstName(user)} does. Changes you make are real in this demo.`}
        confirmLabel="View as them"
        onClose={close}
        onConfirm={() => {
          auth.impersonate(user.id, user.role);
          navigate({ to: user.role === "seller" ? "/seller" : "/buyer" });
        }}
      />
    </AdminPage>
  );
}

