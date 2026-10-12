import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, CircleCheck } from "lucide-react";
import { useState } from "react";
import { Alert, AppLink, Badge, Button, Card, CardHeader, EmptyState, Tooltip } from "@/components/kit";
import { AdminPage, ConfirmModal, DetailSection, SummaryFacts, anySearch, initials, pct, useAction } from "@/components/admin/kit";
import { StatusChip } from "@/components/status";
import { PARTNER_MAPPING, ago_, useAdminActions, useAdminModel } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/advertising/$partnerId")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Ad partner · Admin · OwnerFi" }] }),
  component: PartnerDetail,
});

const KIND = { posted: "Posted", failed: "Failed", sync: "Synced" } as const;
const Back = () => (
  <AppLink to="/admin/advertising" className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-muted hover:text-ink">
    <ArrowLeft aria-hidden className="h-4 w-4" /> Ad partners
  </AppLink>
);

function PartnerDetail() {
  const { partnerId } = Route.useParams();
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const a = useAction();
  const [dlg, setDlg] = useState<null | "toggle" | "rotate">(null);
  const [all, setAll] = useState(false);
  const p = m.partners.find((x) => x.id === partnerId);

  if (!p) {
    return (
      <AdminPage>
        <div className="space-y-4">
          <Back />
          <EmptyState title="We can’t find that partner" description="Go back to the list to find it." action={<AppLink to="/admin/advertising" className="font-semibold text-primary hover:underline">Ad partners</AppLink>} />
        </div>
      </AdminPage>
    );
  }
  const disabled = p.status === "disabled";
  const direct = p.id === "direct";
  const close = () => {
    setDlg(null);
    a.clearError();
  };
  const test = (
    <Button variant="secondary" loading={a.busy === "test"} disabled={disabled} onClick={() => void a.run("test", () => acts.partners.test(p.id), `${p.name} connection works.`)}>
      Test connection
    </Button>
  );
  const logs = all || p.sync.length <= 10 ? p.sync : p.sync.slice(0, 8);

  return (
    <AdminPage>
      <div className="space-y-5">
        <div className="space-y-3">
          <Back />
          <Card padding="none">
            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
              <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-50 font-display text-xl font-bold text-primary-700">
                {initials(p.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold md:text-[28px]">{p.name}</h1>
                  <StatusChip kind="partner" value={p.status} />
                </div>
                <p className="mt-1.5 text-sm text-muted">{p.account}</p>
              </div>
              <div className="flex flex-wrap gap-2 md:shrink-0 md:self-start">
                {disabled ? <Tooltip content="Enable this partner first.">{test}</Tooltip> : test}
                <Button variant={disabled ? "primary" : "danger"} onClick={() => setDlg("toggle")}>
                  {disabled ? "Enable" : "Disable"}
                </Button>
              </div>
            </div>
            <div className="border-t border-ink/[0.08] bg-surface/60 px-5 py-4 md:px-6">
              <SummaryFacts facts={[{ label: "Live ads", value: String(p.stats.live), strong: true }, { label: "Clicks", value: p.stats.clicks.toLocaleString("en-US") }, { label: "Inquiries", value: String(p.stats.inquiries) }, { label: "Error rate", value: pct(p.errorRate) }, { label: "Last synced", value: ago_(p.lastSyncAt) }]} />
            </div>
          </Card>
          {p.status === "needs_attention" && (
            <Alert tone="warning" title={`${p.name} needs attention`}>
              {p.failures[0]?.error ?? "The partner rejected our key."} Rotate the key, then test the connection.
            </Alert>
          )}
          {disabled && (
            <Alert tone="info" title="This partner is off">
              New ads aren’t sent here. Turn it back on when you’re ready.
            </Alert>
          )}
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            <DetailSection id="partner-failures" title="Failures" description="Ads this partner didn’t accept." count={p.failures.length}>
              {p.failures.length ? (
                <ul className="-my-1 space-y-1">
                  {p.failures.map((f) => (
                    <li key={f.id}>
                      <AppLink to={`/admin/vehicles/${f.vehicleId}`} className="-mx-3 flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{f.carName}</span>
                          <span className="block text-sm text-muted">Seller: {f.sellerName}</span>
                          <span className="mt-1 block text-sm">{f.error ?? "The partner didn’t accept this ad."}</span>
                        </span>
                        <span className="mt-0.5 hidden shrink-0 text-sm font-semibold text-primary sm:inline">Open vehicle</span>
                        <ChevronRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                      </AppLink>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState className="py-6" icon={<CircleCheck aria-hidden className="h-6 w-6" />} title="No recent failures" description="Every ad sent to this partner went through." />
              )}
            </DetailSection>
            <DetailSection id="partner-logs" title="Sync logs" description="Posting events and hourly syncs, newest first." count={p.sync.length}>
              <ul className="divide-y divide-ink/10">
                {logs.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0">
                    <Badge tone={l.kind === "failed" ? "danger" : l.kind === "sync" ? "neutral" : "success"}>{KIND[l.kind]}</Badge>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-semibold">
                        {l.vehicleId ? (
                          <AppLink to={`/admin/vehicles/${l.vehicleId}`} className="hover:underline">
                            {m.vehicles.find((v) => v.id === l.vehicleId)?.make ?? l.vehicleId} {m.vehicles.find((v) => v.id === l.vehicleId)?.model}
                          </AppLink>
                        ) : (
                          "All listings"
                        )}
                      </span>
                      <span className="block text-muted">{l.note || "—"}</span>
                    </span>
                    <span className="text-sm text-muted">{ago_(l.at)}</span>
                  </li>
                ))}
              </ul>
              {p.sync.length > 10 && (
                <button type="button" aria-expanded={all} onClick={() => setAll((x) => !x)} className="mt-3 rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-primary-50">
                  {all ? "Show fewer" : `Show all ${p.sync.length} entries`}
                </button>
              )}
            </DetailSection>
          </div>
          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24" aria-label="Setup">
            <Card>
              <CardHeader title="Setup" />
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Account type</dt>
                  <dd className="text-right">{p.account}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">API key</dt>
                  <dd className="min-w-0 break-all text-right font-mono">{p.apiKeyMasked}</dd>
                </div>
                <div>
                  <dt className="text-muted">Ads need</dt>
                  <dd>{p.requirements.length ? p.requirements.join(" · ") : "Nothing"}</dd>
                </div>
              </dl>
              {!direct && (
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => setDlg("rotate")}>
                  Rotate key
                </Button>
              )}
            </Card>
            <Card>
              <CardHeader title="Field mapping" description="How an OwnerFi ad becomes a partner ad." />
              {direct ? (
                <p className="text-sm text-muted">Nothing to sync — links and QR codes are made by OwnerFi.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-muted">
                    <tr>
                      <th scope="col" className="py-1 font-semibold">OwnerFi</th>
                      <th scope="col" className="py-1 font-semibold">Partner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PARTNER_MAPPING.map(([x, y]) => (
                      <tr key={x} className="border-t border-ink/10">
                        <td className="py-2">{x}</td>
                        <td className="py-2 font-mono">{y}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </aside>
        </div>
      </div>
      <ConfirmModal
        open={dlg !== null}
        title={dlg === "rotate" ? "Rotate the key?" : disabled ? `Turn ${p.name} back on?` : `Stop posting to ${p.name}?`}
        body={dlg === "rotate" ? "A new key is made and the old one stops working right away." : disabled ? "Sellers can post and resume their ads again. Paused ads stay paused until the seller resumes them." : `New ads won’t go to ${p.name}. ${p.stats.live} live ${p.stats.live === 1 ? "ad" : "ads"} will be paused and the sellers told.`}
        confirmLabel={dlg === "rotate" ? "Rotate key" : disabled ? "Turn on" : "Stop posting"}
        tone={dlg === "toggle" && !disabled ? "danger" : "primary"}
        busy={!!a.busy}
        error={a.error}
        onClose={close}
        onConfirm={() => void a.run("go", () => (dlg === "rotate" ? acts.partners.rotate(p.id) : disabled ? acts.partners.enable(p.id, p.name) : acts.partners.disable(p.id, p.name)), dlg === "rotate" ? "New key created." : disabled ? `${p.name} is on.` : `${p.name} is off.`).then((ok) => ok && close())}
      />
    </AdminPage>
  );
}
