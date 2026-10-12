import { createFileRoute } from "@tanstack/react-router";
import { addMonths } from "date-fns/addMonths";
import { eachDayOfInterval } from "date-fns/eachDayOfInterval";
import { endOfMonth } from "date-fns/endOfMonth";
import { endOfWeek } from "date-fns/endOfWeek";
import { format } from "date-fns/format";
import { isSameMonth } from "date-fns/isSameMonth";
import { startOfMonth } from "date-fns/startOfMonth";
import { startOfWeek } from "date-fns/startOfWeek";
import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppLink, Badge, Button, Card, EmptyState, Modal, NativeSelect, Segmented, TextInput } from "@/components/kit";
import { AdminHeader, AdminPage, DataTable, FilterBar, KpiCard, anySearch, pageOf, useUrlParams } from "@/components/admin/kit";
import { StatusChip, statusInfo } from "@/components/status";
import { driveStats, useAdminModel, type AdminModel } from "@/lib/admin-data";
import type { Drive, DriveStatus } from "@/lib/drives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/test-drives")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Test drives · Admin · OwnerFi" }] }),
  component: TestDrives,
});

const STATUSES: DriveStatus[] = ["requested", "confirmed", "rescheduled", "completed", "no_show", "declined", "cancelled"];
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayKey = (d: Date | string) => format(new Date(d), "yyyy-MM-dd");
const when = (iso: string) => format(new Date(iso), "EEE, MMM d · h:mm a");
const SIZE = 12;

function find(m: AdminModel, name: string) {
  return m.users.find((u) => u.name === name);
}

function DriveModal({ d, m, onClose }: { d: Drive | undefined; m: AdminModel; onClose: () => void }) {
  const buyer = d && find(m, d.buyerName);
  const seller = d && find(m, d.sellerName);
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
  return (
    <Modal open={!!d} onClose={onClose} title="Test drive" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {d && (
        <dl className="divide-y divide-ink/10">
          {row("Status", <StatusChip kind="testDrive" value={d.status} />)}
          {row("When", when(d.start))}
          {row("Length", `${d.durationMin} minutes`)}
          {row("Place", d.place)}
          {row("Car", d.vehicleId ? <AppLink to={`/admin/vehicles/${d.vehicleId}`} className="text-primary hover:underline">{d.car}</AppLink> : d.car)}
          {row("Buyer", buyer ? <AppLink to={`/admin/users/${buyer.id}`} className="text-primary hover:underline">{d.buyerName}</AppLink> : d.buyerName)}
          {row("Seller", seller ? <AppLink to={`/admin/users/${seller.id}`} className="text-primary hover:underline">{d.sellerName}</AppLink> : d.sellerName)}
          {d.dealId && row("Deal", <AppLink to={`/admin/deals/${d.dealId}`} className="text-primary hover:underline">Open deal {d.dealId}</AppLink>)}
          {d.note && row("Note", d.note)}
        </dl>
      )}
    </Modal>
  );
}

function CalendarCard({ month, drives, day, onMonth, onDay, onOpen }: { month: string; drives: Drive[]; day: string; onMonth: (m: string) => void; onDay: (d: string) => void; onOpen: (id: string) => void }) {
  const first = new Date(`${month}-01T00:00:00`);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(first), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(first), { weekStartsOn: 1 }) });
  const by = new Map<string, Drive[]>();
  for (const d of [...drives].sort((a, b) => a.start.localeCompare(b.start))) by.set(dayKey(d.start), [...(by.get(dayKey(d.start)) ?? []), d]);
  const keys = [...by.keys()].filter((k) => k.startsWith(month)).sort();
  const shift = (n: number) => onMonth(format(addMonths(first, n), "yyyy-MM"));
  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{format(first, "MMMM yyyy")}</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
          {WEEK.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((dt) => {
            const k = dayKey(dt);
            const list = by.get(k) ?? [];
            return (
              <button
                key={k}
                type="button"
                onClick={() => onDay(day === k ? "" : k)}
                aria-pressed={day === k}
                aria-label={`${format(dt, "EEEE, MMMM d")}, ${list.length} test drives`}
                className={cn("min-h-24 rounded-lg border p-1 text-left align-top focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", day === k ? "border-primary bg-primary/5" : "border-ink/10 bg-white", !isSameMonth(dt, first) && "opacity-40")}
              >
                <span className="num text-xs font-semibold">{format(dt, "d")}</span>
                <span className="mt-1 block space-y-1">
                  {list.slice(0, 3).map((d) => (
                    <Badge key={d.id} tone={statusInfo("testDrive", d.status).tone} className="w-full truncate !gap-1 !px-1.5 !py-0.5">
                      <span className="truncate">
                        {format(new Date(d.start), "h:mm a")} {d.car.split(" ").slice(2, 3)}
                      </span>
                    </Badge>
                  ))}
                  {list.length > 3 && <span className="block text-xs text-muted">+{list.length - 3} more</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="md:hidden">
        {keys.length === 0 ? (
          <p className="py-6 text-center text-muted">No test drives this month.</p>
        ) : (
          <ul className="space-y-4">
            {keys.map((k) => (
              <li key={k}>
                <h3 className="mb-1 text-sm font-semibold">{format(new Date(`${k}T00:00:00`), "EEEE, MMM d")}</h3>
                <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
                  {(by.get(k) ?? []).map((d) => (
                    <li key={d.id}>
                      <button type="button" onClick={() => onOpen(d.id)} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left">
                        <span>
                          <span className="block font-medium">
                            {format(new Date(d.start), "h:mm a")} · {d.car}
                          </span>
                          <span className="block text-sm text-muted">
                            {d.buyerName} with {d.sellerName}
                          </span>
                        </span>
                        <StatusChip kind="testDrive" value={d.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function TestDrives() {
  const m = useAdminModel();
  const { params, set, clear } = useUrlParams();
  const [openId, setOpenId] = useState<string | undefined>();
  const view = params.get("view") === "table" ? "table" : "calendar";
  const status = STATUSES.find((s) => s === params.get("status")) ?? "all";
  const q = params.get("q") ?? "";
  const seller = params.get("seller") ?? "";
  const buyer = params.get("buyer") ?? "";
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month")! : format(new Date(), "yyyy-MM");
  const day = params.get("day") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const stats = driveStats(m.drives);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return m.drives
      .filter((d) => status === "all" || d.status === status)
      .filter((d) => !seller || d.sellerName === seller)
      .filter((d) => !buyer || d.buyerName === buyer)
      .filter((d) => !needle || `${d.car} ${d.buyerName} ${d.sellerName}`.toLowerCase().includes(needle));
  }, [m.drives, status, q, seller, buyer]);
  const inMonth = filtered.filter((d) => dayKey(d.start).startsWith(month));
  const tableRows = (view === "calendar" ? (day ? filtered.filter((d) => dayKey(d.start) === day) : inMonth) : day ? filtered.filter((d) => dayKey(d.start) === day) : filtered).sort((a, b) => b.start.localeCompare(a.start));
  const sellers = [...new Set(m.drives.map((d) => d.sellerName))].sort();
  const buyers = [...new Set(m.drives.map((d) => d.buyerName))].sort();
  const filtering = status !== "all" || q !== "" || seller !== "" || buyer !== "" || day !== "";
  const pct = stats.completionRate == null ? "—" : `${Math.round(stats.completionRate * 100)}%`;

  return (
    <AdminPage>
      <AdminHeader title="Test drives" description="Every test drive, scheduled or done." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Scheduled" value={stats.scheduled} hint="Still to come" />
        <KpiCard label="Completed" value={stats.completed} />
        <KpiCard label="No-shows" value={stats.noShow} />
        <KpiCard label="Completion rate" value={pct} hint="Of drives that finished or fell through" />
      </div>
      <div className="mb-4">
        <Segmented label="View" value={view} onChange={(v) => set({ view: v === "calendar" ? null : v })} options={[{ value: "calendar", label: "Calendar" }, { value: "table", label: "Table" }]} />
      </div>
      <FilterBar>
        <TextInput aria-label="Search" size="sm" placeholder="Car, buyer or seller" wrapperClassName="w-full sm:w-72" leftAdornment={<Search aria-hidden className="h-4 w-4" />} value={q} onChange={(e) => set({ q: e.target.value })} />
        <NativeSelect aria-label="Status" size="sm" className="sm:w-44" value={status} onChange={(e) => set({ status: e.target.value === "all" ? null : e.target.value })} options={[{ value: "all", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: statusInfo("testDrive", s).label }))]} />
        <NativeSelect aria-label="Seller" size="sm" className="sm:w-44" value={seller} onChange={(e) => set({ seller: e.target.value })} options={[{ value: "", label: "All sellers" }, ...sellers.map((s) => ({ value: s, label: s }))]} />
        <NativeSelect aria-label="Buyer" size="sm" className="sm:w-44" value={buyer} onChange={(e) => set({ buyer: e.target.value })} options={[{ value: "", label: "All buyers" }, ...buyers.map((s) => ({ value: s, label: s }))]} />
      </FilterBar>
      {view === "calendar" && <CalendarCard month={month} drives={filtered} day={day} onMonth={(x) => set({ month: x, day: null })} onDay={(x) => set({ day: x })} onOpen={setOpenId} />}
      {day && (
        <p className="mb-2 text-sm text-muted">
          Showing {day}.{" "}
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => set({ day: null })}>
            Clear day
          </button>
        </p>
      )}
      <DataTable<Drive>
        caption="Test drives"
        rows={pageOf(tableRows, page, SIZE)}
        total={tableRows.length}
        page={page}
        pageSize={SIZE}
        onPageChange={(p) => set({ page: String(p) })}
        getRowId={(d) => d.id}
        columns={[
          { key: "time", header: "Time", render: (d) => <button type="button" onClick={() => setOpenId(d.id)} className="rounded-lg text-left font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{when(d.start)}</button> },
          { key: "car", header: "Car", render: (d) => d.car },
          { key: "buyer", header: "Buyer", render: (d) => d.buyerName },
          { key: "seller", header: "Seller", render: (d) => d.sellerName },
          { key: "place", header: "Place", render: (d) => d.place },
          { key: "status", header: "Status", render: (d) => <StatusChip kind="testDrive" value={d.status} /> },
          { key: "deal", header: "Deal", render: (d) => (d.dealId ? <AppLink to={`/admin/deals/${d.dealId}`} className="font-semibold text-primary hover:underline">{d.dealId}</AppLink> : "—") },
        ]}
        emptyState={<EmptyState icon={<CalendarDays aria-hidden className="h-6 w-6" />} title="No test drives match" description="Try a different search, month or filter." action={filtering ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} />}
      />
      <DriveModal d={m.drives.find((x) => x.id === openId)} m={m} onClose={() => setOpenId(undefined)} />
    </AdminPage>
  );
}
