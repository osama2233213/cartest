import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { ChevronDown, ChevronRight, Download, ScrollText, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Badge, Button, EmptyState, NativeSelect, TextInput, useToast } from "@/components/kit";
import { AdminHeader, AdminPage, FilterBar, anySearch, useUrlParams } from "@/components/admin/kit";
import { AREA_LABEL, AUDIT_AREAS, fileCsv, useAdminModel, type AuditArea, type AuditEntry } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/audit-log")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Audit log · Admin · OwnerFi" }] }),
  component: AuditLog,
});

const RANGES = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];
const HOURS: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
const SIZE = 20;

const Change = ({ r }: { r: AuditEntry }) =>
  r.before || r.after ? (
    <span className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted">
      {r.before ?? "—"} → {r.after ?? "—"}
    </span>
  ) : (
    <span className="text-muted">—</span>
  );

function AuditLog() {
  const m = useAdminModel();
  const toast = useToast();
  const { params, set, clear } = useUrlParams();
  const [open, setOpen] = useState<string | undefined>();
  const q = params.get("q") ?? "";
  const actor = params.get("actor") ?? "all";
  const area = (AUDIT_AREAS as string[]).includes(params.get("area") ?? "") ? (params.get("area") as AuditArea) : "all";
  const range = RANGES.find((r) => r.value === params.get("range"))?.value ?? "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const all = m.s.audit;
  const actors = useMemo(() => [...new Set(all.map((e) => e.actor))].sort(), [all]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cutoff = HOURS[range] ? Date.now() - HOURS[range]! * 3_600_000 : 0;
    return all
      .filter((e) => actor === "all" || e.actor === actor)
      .filter((e) => area === "all" || e.area === area)
      .filter((e) => new Date(e.at).getTime() >= cutoff)
      .filter((e) => !needle || `${e.label} ${e.target} ${e.actor} ${e.action}`.toLowerCase().includes(needle))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [all, q, actor, area, range]);
  const pages = Math.max(1, Math.ceil(rows.length / SIZE));
  const shown = rows.slice((page - 1) * SIZE, page * SIZE);
  const filtering = q !== "" || actor !== "all" || area !== "all" || range !== "all";

  const exportCsv = () => {
    const n = fileCsv("ownerfi-audit-log.csv", [["When", "Who", "Action", "Area", "Target", "Before", "After"], ...rows.map((r) => [r.at, r.actor, r.action, AREA_LABEL[r.area], r.target, r.before ?? "", r.after ?? ""])]);
    toast({ tone: "success", title: `Exported ${n} ${n === 1 ? "entry" : "entries"}.` });
  };

  return (
    <AdminPage>
      <AdminHeader title="Audit log" description="Everything admins and the system changed." action={<Button variant="secondary" leftIcon={<Download aria-hidden className="h-4 w-4" />} onClick={exportCsv}>Export CSV</Button>} />
      <FilterBar>
        <TextInput aria-label="Search" size="sm" value={q} onChange={(e) => set({ q: e.target.value })} placeholder="Action, target or person" wrapperClassName="w-full sm:w-72" leftAdornment={<Search aria-hidden className="h-4 w-4" />} />
        <NativeSelect aria-label="Who" size="sm" className="sm:w-44" value={actor} onChange={(e) => set({ actor: e.target.value === "all" ? null : e.target.value })} options={[{ value: "all", label: "Everyone" }, ...actors.map((a) => ({ value: a, label: a }))]} />
        <NativeSelect aria-label="Area" size="sm" className="sm:w-44" value={area} onChange={(e) => set({ area: e.target.value === "all" ? null : e.target.value })} options={[{ value: "all", label: "All areas" }, ...AUDIT_AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] }))]} />
        <NativeSelect aria-label="Date" size="sm" className="sm:w-44" value={range} onChange={(e) => set({ range: e.target.value === "all" ? null : e.target.value })} options={RANGES} />
      </FilterBar>
      <div className="rounded-2xl border border-ink/10 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <caption className="sr-only">Audit log</caption>
            <thead className="bg-surface">
              <tr>
                {["", "When", "Who", "What", "Target", "Change"].map((h) => (
                  <th key={h || "x"} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold text-muted">
                    {h || <span className="sr-only">Details</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <Fragment key={e.id}>
                  <tr className="border-t border-ink/10">
                    <td className="w-10 px-2 py-3">
                      <button type="button" aria-expanded={open === e.id} aria-label={`${open === e.id ? "Hide" : "Show"} details for ${e.label}`} onClick={() => setOpen(open === e.id ? undefined : e.id)} className="rounded p-1 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        {open === e.id ? <ChevronDown aria-hidden className="h-4 w-4" /> : <ChevronRight aria-hidden className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{format(new Date(e.at), "MMM d, yyyy h:mm a")}</td>
                    <td className="px-4 py-3">{e.system ? <Badge>System</Badge> : e.actor}</td>
                    <td className="px-4 py-3 font-semibold">{e.label}</td>
                    <td className="px-4 py-3">{e.target}</td>
                    <td className="px-4 py-3">
                      <Change r={e} />
                    </td>
                  </tr>
                  {open === e.id && (
                    <tr className="bg-surface/60">
                      <td />
                      <td colSpan={5} className="px-4 py-3">
                        <dl className="grid gap-2 text-sm sm:grid-cols-4">
                          <div>
                            <dt className="text-muted">Action code</dt>
                            <dd className="font-mono">{e.action}</dd>
                          </div>
                          <div>
                            <dt className="text-muted">Area</dt>
                            <dd>{AREA_LABEL[e.area]}</dd>
                          </div>
                          <div>
                            <dt className="text-muted">Before</dt>
                            <dd>{e.before ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted">After</dt>
                            <dd>{e.after ?? "—"}</dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <EmptyState icon={<ScrollText aria-hidden className="h-6 w-6" />} title={filtering ? "Nothing matches" : "No changes recorded yet"} description={filtering ? "Try a different search, person, area or date." : "Changes made by admins show up here."} action={filtering ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} />
        )}
      </div>
      {rows.length > SIZE && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">
            {rows.length} entries{filtering ? ` of ${all.length}` : ""} · Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>
              Next
            </Button>
          </div>
        </nav>
      )}
    </AdminPage>
  );
}
