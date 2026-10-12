import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Megaphone, Search } from "lucide-react";
import { useState } from "react";
import { AppLink, Button, EmptyState, Segmented, TextInput } from "@/components/kit";
import { ActionMenu, AdminHeader, AdminPage, ConfirmModal, DataTable, FilterBar, KpiCard, anySearch, initials, pct, useAction, useUrlParams } from "@/components/admin/kit";
import { StatusChip } from "@/components/status";
import { ago_, useAdminActions, useAdminModel, type PartnerView } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/advertising/")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Ad partners · Admin · OwnerFi" }] }),
  component: Partners,
});

const FILTERS = [
  { value: "all", label: "All" },
  { value: "connected", label: "Connected" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "disabled", label: "Disabled" },
];
const Mark = ({ name }: { name: string }) => (
  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
    {initials(name)}
  </span>
);

function Partners() {
  const m = useAdminModel();
  const acts = useAdminActions(m);
  const navigate = useNavigate();
  const a = useAction();
  const { params, set, clear } = useUrlParams();
  const [toggle, setToggle] = useState<PartnerView | undefined>();
  const status = FILTERS.find((f) => f.value === params.get("status"))?.value ?? "all";
  const q = params.get("q") ?? "";
  const rows = m.partners.filter((p) => (status === "all" || p.status === status) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const connected = m.partners.filter((p) => p.status === "connected").length;
  const live = m.partners.reduce((s, p) => s + p.stats.live, 0);
  const clicks = m.partners.reduce((s, p) => s + p.stats.clicks, 0);
  const err = m.partners.length ? m.partners.reduce((s, p) => s + p.errorRate, 0) / m.partners.length : 0;
  const off = toggle?.status !== "disabled";
  const filtering = status !== "all" || q !== "";

  const menu = (p: PartnerView) => (
    <ActionMenu
      triggerLabel={`Actions for ${p.name}`}
      trigger={<MoreHorizontal aria-hidden className="h-5 w-5" />}
      items={[
        { label: "View sync logs", onSelect: () => navigate({ to: "/admin/advertising/$partnerId", params: { partnerId: p.id }, search: { tab: "logs" } as never }) },
        { label: a.busy === `test-${p.id}` ? "Testing…" : "Test connection", onSelect: () => void a.run(`test-${p.id}`, () => acts.partners.test(p.id), `${p.name} connection works.`) },
        { label: p.status === "disabled" ? "Enable" : "Disable", danger: p.status !== "disabled", onSelect: () => { a.clearError(); setToggle(p); } },
      ]}
    />
  );

  return (
    <AdminPage>
      <AdminHeader title="Ad partners" description="Where seller ads are posted. Check these when a seller says their ad didn’t go up." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Connected" value={`${connected} of ${m.partners.length}`} />
        <KpiCard label="Live ads" value={live} />
        <KpiCard label="Clicks" value={clicks.toLocaleString("en-US")} />
        <KpiCard label="Error rate" value={pct(err)} hint={err >= 0.05 ? "Higher than usual" : "Looking healthy"} />
      </div>
      {a.error && !toggle && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {a.error}
        </p>
      )}
      <FilterBar>
        <Segmented label="Status" value={status} onChange={(v) => set({ status: v === "all" ? null : v })} options={FILTERS} />
        <TextInput aria-label="Search" size="sm" value={q} onChange={(e) => set({ q: e.target.value })} placeholder="Partner name" wrapperClassName="w-full sm:w-72" leftAdornment={<Search aria-hidden className="h-4 w-4" />} />
      </FilterBar>
      <DataTable<PartnerView>
        caption="Ad partners"
        rows={rows}
        getRowId={(p) => p.id}
        columns={[
          {
            key: "partner",
            header: "Partner",
            render: (p) => (
              <div className="flex items-center gap-3">
                <Mark name={p.name} />
                <div>
                  <AppLink to={`/admin/advertising/${p.id}`} className="rounded font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    {p.name}
                  </AppLink>
                  <p className="text-xs text-muted">{p.account}</p>
                </div>
              </div>
            ),
          },
          { key: "status", header: "Status", render: (p) => <StatusChip kind="partner" value={p.status} /> },
          { key: "live", header: "Live ads", align: "right", render: (p) => p.stats.live },
          { key: "clicks", header: "Clicks", align: "right", render: (p) => p.stats.clicks.toLocaleString("en-US") },
          { key: "inq", header: "Inquiries", align: "right", render: (p) => p.stats.inquiries },
          { key: "err", header: "Error rate", align: "right", render: (p) => <span className={p.errorRate >= 0.05 ? "font-semibold text-warning" : undefined}>{pct(p.errorRate)}</span> },
          { key: "sync", header: "Last synced", render: (p) => ago_(p.lastSyncAt) },
          { key: "actions", header: "", align: "right", render: menu },
        ]}
        mobileCard={(p) => (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mark name={p.name} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted">{p.account}</p>
              </div>
              <StatusChip kind="partner" value={p.status} />
            </div>
            <p className="text-sm text-muted">
              {p.stats.live} live · {p.stats.clicks} clicks · {p.stats.inquiries} inquiries · {pct(p.errorRate)} errors
            </p>
            <div className="flex items-center gap-2">
              <AppLink to={`/admin/advertising/${p.id}`} className="flex-1">
                <span className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-ink/15 bg-white text-[15px] font-semibold shadow-card">Details</span>
              </AppLink>
              {menu(p)}
            </div>
          </div>
        )}
        emptyState={<EmptyState icon={<Megaphone aria-hidden className="h-6 w-6" />} title={filtering ? "No partners match" : "No partners yet"} description={filtering ? "Try a different status or name." : "Partners show up here once they are set up."} action={filtering ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} />}
      />
      <ConfirmModal
        open={!!toggle}
        title={off ? `Stop posting to ${toggle?.name}?` : `Turn ${toggle?.name} back on?`}
        body={off ? `New ads won’t go to ${toggle?.name}. ${toggle?.stats.live ?? 0} live ${toggle?.stats.live === 1 ? "ad" : "ads"} will be paused and the sellers told.` : "Sellers can post and resume their ads again. Paused ads stay paused until the seller resumes them."}
        confirmLabel={off ? "Stop posting" : "Turn on"}
        tone={off ? "danger" : "primary"}
        busy={a.busy === "toggle"}
        error={a.error}
        onClose={() => { setToggle(undefined); a.clearError(); }}
        onConfirm={() => toggle && void a.run("toggle", () => (off ? acts.partners.disable(toggle.id, toggle.name) : acts.partners.enable(toggle.id, toggle.name)), off ? `${toggle.name} is off.` : `${toggle.name} is on.`).then((ok) => ok && setToggle(undefined))}
      />
    </AdminPage>
  );
}
