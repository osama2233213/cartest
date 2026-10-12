import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Alert, AppLink, Button, Card, CardHeader, EmptyState, NativeSelect, TextArea } from "@/components/kit";
import { ActionMenu, AdminPage, ConfirmModal, NoteModal, useAction } from "@/components/admin/kit";
import { DealRoomBody } from "@/components/app/DealRoom";
import { ago_, useAdminActions, useAdminModel, type DealRow } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/deals/$id")({
  head: () => ({ meta: [{ title: "Deal · Admin · OwnerFi" }] }),
  component: AdminDeal,
});

const PAUSE_REASONS = ["Waiting for documents", "Dispute between parties", "Suspected fraud", "Other"];
const hrefCls = "font-semibold text-primary hover:underline";

function Toolbar({ r }: { r: DealRow }) {
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const [dlg, setDlg] = useState<null | "pause" | "escalate" | "cancel" | "default">(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const closed = ["paid_off", "declined", "cancelled", "defaulted"].includes(r.deal.stage);
  const canPause = !closed && !r.paused;
  const canResume = !closed && !!r.paused;
  const canCancel = !closed && r.deal.stage !== "active";
  const canDefault = r.deal.stage === "active" && r.late;
  const close = () => {
    setDlg(null);
    setReason("");
    setNote("");
    a.clearError();
  };
  const seller = r.deal.seller.split(" ")[0] ?? r.deal.seller;
  const items = [
    ...(!closed ? [{ label: "Escalate", onSelect: () => setDlg("escalate" as const) }] : []),
    ...(canDefault ? [{ label: "Mark as default", danger: true, onSelect: () => setDlg("default" as const) }] : []),
    ...(canCancel ? [{ label: "Cancel deal", danger: true, onSelect: () => setDlg("cancel" as const) }] : []),
  ];
  return (
    <div className="space-y-3">
      <Card padding="sm" className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted">
          Deal <span className="num font-semibold text-ink">{r.id}</span> ·{" "}
          {r.seller ? <AppLink to={`/admin/users/${r.seller.id}`} className={hrefCls}>{r.deal.seller}</AppLink> : r.deal.seller} (seller) ·{" "}
          {r.buyer ? <AppLink to={`/admin/users/${r.buyer.id}`} className={hrefCls}>{r.deal.buyer}</AppLink> : r.deal.buyer} (buyer)
          {r.vehicle && (
            <>
              {" "}· <AppLink to={`/admin/vehicles/${r.vehicle.id}`} className={hrefCls}>Open the car</AppLink>
            </>
          )}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {canPause && <Button onClick={() => setDlg("pause")}>Pause deal</Button>}
          {canResume && <Button loading={a.busy === "resume"} onClick={() => void a.run("resume", () => acts.deals.resume(r), "Deal resumed.")}>Resume deal</Button>}
          <Button
            variant="secondary"
            onClick={() => {
              const el = document.getElementById("admin-notes");
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              el?.querySelector("textarea")?.focus();
            }}
          >
            Add note
          </Button>
          {items.length > 0 && (
            <ActionMenu
              triggerLabel="More actions"
              trigger={
                <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-semibold">
                  <MoreHorizontal aria-hidden className="h-4 w-4" /> More
                </span>
              }
              items={items}
            />
          )}
        </div>
      </Card>
      {r.paused && (
        <Alert tone="warning" title="This deal is paused">
          {r.paused.reason}. Nothing moves until you resume it.
        </Alert>
      )}
      {r.escalatedAt && (
        <Alert tone="info">
          Escalated {ago_(r.escalatedAt)}.{r.escalationNote ? ` ${r.escalationNote}` : ""}
        </Alert>
      )}
      <ConfirmModal open={dlg === "pause"} title="Pause this deal?" body="Both people are told it’s on hold. Nothing is charged or cancelled." confirmLabel="Pause deal" busy={a.busy === "pause"} error={a.error} onClose={close} onConfirm={() => reason && void a.run("pause", () => acts.deals.pause(r, reason, note), "Deal paused.").then((ok) => ok && close())}>
        <NativeSelect label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={[{ value: "", label: "Pick a reason" }, ...PAUSE_REASONS.map((x) => ({ value: x, label: x }))]} />
        <TextArea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </ConfirmModal>
      <ConfirmModal open={dlg === "escalate"} title="Escalate this deal?" body="It’s marked for a closer look by the OwnerFi team." confirmLabel="Escalate" busy={a.busy === "escalate"} error={a.error} onClose={close} onConfirm={() => void a.run("escalate", () => acts.deals.escalate(r, note), "Escalated.").then((ok) => ok && close())}>
        <TextArea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </ConfirmModal>
      <ConfirmModal open={dlg === "default"} title="Mark this deal as defaulted?" body={`The buyer’s payments stop and ${seller} sees their options.`} confirmLabel="Mark as default" tone="danger" busy={a.busy === "default"} error={a.error} onClose={close} onConfirm={() => void a.run("default", () => acts.deals.markDefault(r), "Marked as default.").then((ok) => ok && close())} />
      <NoteModal open={dlg === "cancel"} title="Cancel this deal?" description="The car goes back on the market. Both people are told. Any payment already made is handled outside this screen." label="Why are you cancelling?" helper="At least 10 characters. Both people will see this." confirmLabel="Cancel the deal" tone="danger" busy={a.busy === "cancel"} error={a.error} onClose={close} onSubmit={(t) => void a.run("cancel", () => acts.deals.cancel(r, t), "Deal cancelled. Both people were told.").then((ok) => ok && close())} />
    </div>
  );
}

function AdminDeal() {
  const { id } = Route.useParams();
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const [text, setText] = useState("");
  const r = m.dealRows.find((x) => x.id === id);

  if (!r) {
    return (
      <AdminPage>
        <EmptyState title="We can’t find that deal" description="It may have been removed, or the link is wrong." action={<AppLink to="/admin/deals" className="font-semibold text-primary hover:underline">All deals</AppLink>} />
      </AdminPage>
    );
  }
  return (
    <div>
      <DealRoomBody id={id} role="admin" toolbar={<Toolbar r={r} />} back={{ to: "/admin/deals", label: "All deals" }} />
      <div className="mx-auto mt-5 max-w-6xl xl:pr-[380px]">
        <Card id="admin-notes">
          <CardHeader title="Admin notes" />
          <div className="space-y-3">
            <TextArea label="Add a note" helper="Only admins can see notes." value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            {a.error && <Alert tone="danger">{a.error}</Alert>}
            <Button loading={a.busy === "note"} disabled={!text.trim()} onClick={() => void a.run("note", () => acts.deals.addNote(r, text), "Note added.").then((ok) => ok && setText(""))}>
              Add note
            </Button>
            {r.adminNotes.length === 0 ? (
              <p className="text-muted">No notes yet. Notes are only visible to admins.</p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {r.adminNotes.map((n) => (
                  <li key={n.id} className="py-3">
                    <p>{n.text}</p>
                    <p className="text-sm text-muted">
                      {n.by} · {ago_(n.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
