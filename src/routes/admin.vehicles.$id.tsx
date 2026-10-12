import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, FileText, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Alert, AppLink, Avatar, Badge, Button, Card, CardHeader, EmptyState, NativeSelect, TextArea } from "@/components/kit";
import { ActionMenu, AdminPage, ConfirmModal, DetailSection, SummaryFacts, useAction } from "@/components/admin/kit";
import { CarImage } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { ago_, checkSummary, dateShort, firstName, hasVehicleId, useAdminActions, useAdminModel, vehicleName, type AdminVehicle } from "@/lib/admin-data";
import { moneyC, miles } from "@/lib/format";
import { CHANNELS, useAds } from "@/lib/ads";

export const Route = createFileRoute("/admin/vehicles/$id")({
  head: () => ({ meta: [{ title: "Car · Admin · OwnerFi" }] }),
  component: VehicleDetail,
});

const TAKEDOWN = ["Failed safety check", "Misleading listing", "Seller request", "Duplicate listing", "Other"];
const CHECK_ROWS: [keyof AdminVehicle["checks"], string][] = [
  ["lien", "Lien check"],
  ["theft", "Theft check"],
  ["brand", "Title brand"],
  ["history", "Vehicle history"],
];
const CHECK_NOTE: Record<string, string> = { pass: "Nothing found.", fail: "A problem was found.", review: "Needs a manual look.", pending: "Waiting for results." };

const Back = () => (
  <AppLink to="/admin/vehicles" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
    <ArrowLeft aria-hidden className="h-4 w-4" /> All vehicles
  </AppLink>
);

function VehicleDetail() {
  const { id } = Route.useParams();
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const act = useAction();
  const [dlg, setDlg] = useState<null | "approve" | "changes" | "takedown" | "clear" | "confirm">(null);
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const v = m.vehicles.find((x) => hasVehicleId(x, id));

  if (!v) {
    return (
      <AdminPage>
        <div className="space-y-4">
          <Back />
          <EmptyState title="We can’t find that car" description="It may have been removed. Go back to the list to find it." action={<Button variant="secondary" onClick={() => history.back()}>Go back</Button>} />
        </div>
      </AdminPage>
    );
  }

  const first = v.seller ? firstName(v.seller) : "The seller";
  const sum = checkSummary(v);
  const deals = m.dealRows.filter((r) => r.deal.car.startsWith(vehicleName(v)));
  const queue = m.s.queue.filter((q) => hasVehicleId(v, q.vehicleId));
  const locked = v.inDeal;
  const canApprove = (v.status === "pending_review" || v.status === "verifying") && v.checks.lien !== "fail" && v.checks.theft !== "fail";
  const canChanges = !locked && v.status !== "blocked";
  const canTake = v.status === "listed" || v.status === "pending_review";
  const close = () => {
    setDlg(null);
    setText("");
    setReason("");
    act.clearError();
  };
  const done = (ok: boolean) => ok && close();
  const menu = [
    ...(!locked && canChanges ? [{ label: "Request changes", onSelect: () => setDlg("changes" as const) }] : []),
    ...(!locked && canTake ? [{ label: "Take down", danger: true, onSelect: () => setDlg("takedown" as const) }] : []),
    ...(v.flagged && v.flagItem ? [{ label: "Clear flag", onSelect: () => setDlg("clear" as const) }, { label: "Confirm flag", danger: true, onSelect: () => setDlg("confirm" as const) }] : []),
  ];
  const details: [string, string][] = [
    ["VIN", v.vin],
    ["Car", `${vehicleName(v)} ${v.trim}`.trim()],
    ["Body", v.body],
    ["Mileage", miles(v.mileage)],
    ["Colours", `${v.exteriorColor} outside, ${v.interiorColor} inside`],
    ["Condition", v.condition],
    ["Location", `${v.city}, ${v.state} ${v.zip}`],
    ["Market value", `${moneyC(v.market.low)} – ${moneyC(v.market.high)}`],
    ["Asking price", moneyC(v.asking)],
    ["Smallest down payment", `${v.minDownPct}%`],
    ["Interest rate", `${v.apr}%`],
    ["Allowed terms", v.allowedTerms.map((t) => `${t} mo`).join(", ")],
    ["Views · saves", `${v.views} · ${v.saves}`],
  ];
  const sellerAds = useAds(v.id);
  const ads = m.s.audit.length >= 0 ? m.partners.map((p) => ({ p, live: v.liveAds > 0 && p.stats.live > 0 })).filter((x) => x.live).slice(0, v.liveAds) : [];

  return (
    <AdminPage>
      <div className="space-y-5">
        <div className="space-y-3">
          <Back />
          <Card padding="none">
            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
              <CarImage src={v.photos[0]} alt="" make={v.make} model={v.model} className="h-24 w-32 shrink-0 !rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold md:text-[28px]">
                    {vehicleName(v)} {v.trim}
                  </h1>
                  <StatusChip kind="vehicle" value={v.status} />
                  {v.flagged && <Badge tone="danger">Flagged</Badge>}
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  <span className="num">VIN {v.vin}</span> · Seller{" "}
                  {v.seller ? (
                    <AppLink to={`/admin/users/${v.seller.id}`} className="font-semibold text-primary hover:underline">
                      {v.seller.name}
                    </AppLink>
                  ) : (
                    v.sellerName
                  )}
                  {` · Listed ${ago_(v.listedAt)}`}
                </p>
              </div>
              {!locked && (canApprove || menu.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:self-start">
                  {canApprove && <Button onClick={() => setDlg("approve")}>Approve listing</Button>}
                  {menu.length > 0 && (
                    <ActionMenu
                      triggerLabel="More actions"
                      trigger={
                        <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink/15 bg-white px-4 text-[15px] font-semibold shadow-card hover:bg-surface">
                          <MoreHorizontal aria-hidden className="h-4 w-4" /> Actions
                        </span>
                      }
                      items={menu}
                    />
                  )}
                </div>
              )}
            </div>
            <div className="border-t border-ink/[0.08] bg-surface/60 px-5 py-4 md:px-6">
              <SummaryFacts
                facts={[
                  { label: "Asking price", value: moneyC(v.asking), strong: true },
                  { label: "Market value", value: `${moneyC(v.market.low)}–${moneyC(v.market.high)}` },
                  { label: "Smallest down payment", value: `${v.minDownPct}%` },
                  { label: "Interest rate", value: `${v.apr}%` },
                  { label: "Views · saves", value: `${v.views} · ${v.saves}` },
                ]}
              />
            </div>
          </Card>
          {v.flagItem && (
            <Alert tone="warning" action={<AppLink to={`/admin/verifications?item=${v.flagItem.id}`} className="self-center text-sm font-semibold text-primary hover:underline">Open in queue</AppLink>}>
              {v.flagItem.notes ?? "This car was flagged for review."}
            </Alert>
          )}
          {v.status === "blocked" && <Alert tone="danger">This car didn’t pass the safety checks, so it can’t be listed.</Alert>}
          {locked && (
            <Alert tone="info" action={deals[0] ? <AppLink to={`/admin/deals/${deals[0].id}`} className="self-center text-sm font-semibold text-primary hover:underline">Open the deal</AppLink> : undefined}>
              This car is part of a deal, so it can’t be changed here.
            </Alert>
          )}
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            <DetailSection id="vehicle-checks" title="Safety checks" description="Lien, theft, title brand and history." action={<Badge tone={sum.tone}>{sum.label}</Badge>}>
              <ul className="divide-y divide-ink/10">
                {CHECK_ROWS.map(([key, label]) => (
                  <li key={key} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-muted">{CHECK_NOTE[v.checks[key]]}</p>
                    </div>
                    <StatusChip kind="check" value={v.checks[key]} />
                  </li>
                ))}
              </ul>
            </DetailSection>
            <DetailSection id="vehicle-review" title="Review items" description="What was sent to the verification queue." count={queue.length}>
              {queue.length === 0 ? (
                <p className="text-muted">Nothing has been sent to the queue for this car.</p>
              ) : (
                <ul className="divide-y divide-ink/10">
                  {queue.map((q) => (
                    <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-medium">{q.type === "title" ? "Title" : "Flagged car"}</p>
                        <p className="text-sm text-muted">
                          Sent {ago_(q.submittedAt)}
                          {q.notes && ` · ${q.notes}`}
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
            <DetailSection id="vehicle-details" title="Car details">
              <dl className="divide-y divide-ink/10 text-sm">
                {details.map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5 first:pt-0">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium">{val}</dd>
                  </div>
                ))}
              </dl>
              {v.description && <p className="mt-4 text-sm text-muted">{v.description}</p>}
              {v.features.length > 0 && (
                <p className="mt-3 text-sm">
                  <span className="text-muted">Features: </span>
                  {v.features.join(", ")}
                </p>
              )}
            </DetailSection>
            <DetailSection id="vehicle-ads" title="Ad listings" count={sellerAds.length > 0 ? sellerAds.length : ads.length} action={<AppLink to="/admin/advertising" className="text-sm font-semibold text-primary hover:underline">Ad partners</AppLink>}>
              {sellerAds.length > 0 ? (
                <ul className="divide-y divide-ink/10">
                  {sellerAds.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-semibold">{CHANNELS.find((c) => c.id === a.channelId)?.name ?? a.channelId}</p>
                        <p className="num text-sm text-muted">{a.status === "failed" ? (a.error ?? "Failed") : `Posted ${new Date(a.postedAt).toLocaleDateString()} · ${a.impressions} views`}</p>
                      </div>
                      <StatusChip kind="adChannel" value={a.status} />
                    </li>
                  ))}
                </ul>
              ) : ads.length === 0 ? (
                <p className="text-muted">Not advertised yet.</p>
              ) : (
                <ul className="divide-y divide-ink/10">
                  {ads.map(({ p }) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-semibold">{p.name}</p>
                        <p className="num text-sm text-muted">Posted {ago_(v.listedAt)} · {v.views} views</p>
                      </div>
                      <StatusChip kind="adChannel" value="live" />
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
            <DetailSection id="vehicle-deals" title="Deals" count={deals.length}>
              {deals.length === 0 ? (
                <p className="text-muted">No deals on this car yet.</p>
              ) : (
                <ul className="-my-1 space-y-1">
                  {deals.map((r) => (
                    <li key={r.id}>
                      <AppLink to={`/admin/deals/${r.id}`} className="-mx-3 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface">
                        <Avatar name={r.deal.buyer} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{r.deal.buyer}</span>
                          <span className="block text-sm text-muted">Updated {r.deal.updated}</span>
                        </span>
                        <StatusChip kind="deal" value={r.deal.stage} />
                        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                      </AppLink>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
          </div>
          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24" aria-label="At a glance">
            <Card>
              <CardHeader title="Seller" />
              {v.seller ? (
                <>
                  <AppLink to={`/admin/users/${v.seller.id}`} className="-mx-3 flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface">
                    <Avatar name={v.seller.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{v.seller.name}</span>
                      <span className="block truncate text-sm text-muted">
                        {v.seller.city}, {v.seller.state}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                  </AppLink>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink/10 pt-3 text-sm">
                    <span className="text-muted">ID check</span>
                    <StatusChip kind="verification" value={v.seller.verification.identity} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">We can’t find the seller for this car.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="Documents" />
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted">Title document</p>
              <div className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-xl bg-surface px-4 text-center text-muted">
                <FileText aria-hidden className="h-7 w-7" />
                <span className="max-w-full truncate text-sm">{v.titleFileName}</span>
                <span className="text-xs">Sample image</span>
              </div>
              <p className="mb-1 mt-5 text-xs font-semibold uppercase tracking-[0.06em] text-muted">Other documents</p>
              {deals.length === 0 ? (
                <p className="text-sm text-muted">No documents yet.</p>
              ) : (
                <ul className="divide-y divide-ink/10">
                  {deals.slice(0, 2).map((r) => (
                    <li key={r.id} className="flex items-start gap-3 py-2.5 last:pb-0">
                      <FileText aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">Financing agreement</span>
                        <span className="block text-sm text-muted">Deal {r.id}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <section aria-labelledby="buyer-view-title">
              <h3 id="buyer-view-title" className="mb-2 text-sm font-semibold text-muted">
                How buyers see it
              </h3>
              <AppLink to={`/cars/${v.id}`} className="block overflow-hidden rounded-2xl border border-ink/[0.08] bg-white shadow-card hover:shadow-raised">
                <CarImage src={v.photos[0]} alt={vehicleName(v)} make={v.make} model={v.model} className="rounded-none" />
                <div className="space-y-1 p-4">
                  <p className="font-semibold">{vehicleName(v)}</p>
                  <p className="num text-sm text-muted">
                    {miles(v.mileage)} · {v.city}, {v.state}
                  </p>
                  <p className="num font-bold">{moneyC(v.asking)}</p>
                  <p className="text-xs text-muted">{v.seller?.verification.identity === "verified" ? "Verified seller" : "Seller not verified"} · listed {dateShort(v.listedAt)}</p>
                </div>
              </AppLink>
            </section>
          </aside>
        </div>
      </div>

      <ConfirmModal open={dlg === "approve"} title="Approve this listing?" body={`It goes live straight away and ${first} is told.`} confirmLabel="Approve" busy={act.busy === "approve"} error={act.error} onClose={close} onConfirm={() => void act.run("approve", () => acts.vehicles.approve(v), `Listing approved. ${first} was told.`).then(done)} />
      <ConfirmModal open={dlg === "changes"} title="Ask for changes" body={`${first} gets your message and the car goes back to draft so they can fix it.`} confirmLabel="Send request" busy={act.busy === "changes"} error={act.error} onClose={close} onConfirm={() => text.trim().length >= 10 && void act.run("changes", () => acts.vehicles.requestChanges(v, text), "Changes requested.").then(done)}>
        <TextArea label="What should they fix?" helper="At least 10 characters." value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      </ConfirmModal>
      <ConfirmModal open={dlg === "takedown"} title="Take this car down?" body="It comes off the marketplace and its ads are paused. The seller is told why." confirmLabel="Take down" tone="danger" busy={act.busy === "takedown"} error={act.error} onClose={close} onConfirm={() => reason && void act.run("takedown", () => acts.vehicles.takeDown(v, reason, text), "Taken down.").then(done)}>
        <div className="space-y-3">
          <NativeSelect label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={[{ value: "", label: "Pick a reason" }, ...TAKEDOWN.map((r) => ({ value: r, label: r }))]} />
          <TextArea label="Note (optional)" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        </div>
      </ConfirmModal>
      <ConfirmModal open={dlg === "clear" || dlg === "confirm"} title={dlg === "clear" ? "Clear this flag?" : "Confirm this flag?"} body={dlg === "clear" ? "The car is fine. If it was waiting for review, it goes live." : "The car comes off the marketplace and the seller is told."} confirmLabel={dlg === "clear" ? "Clear flag" : "Confirm flag"} tone={dlg === "confirm" ? "danger" : "primary"} busy={act.busy === "flag"} error={act.error} onClose={close} onConfirm={() => void act.run("flag", () => (dlg === "confirm" ? acts.vehicles.confirmFlag(v, text) : acts.vehicles.clearFlag(v, text)), dlg === "confirm" ? "Flag confirmed. The car is off the marketplace." : "Flag cleared.").then(done)}>
        <TextArea label="Note for the team (optional)" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      </ConfirmModal>
    </AdminPage>
  );
}
