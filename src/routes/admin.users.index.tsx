import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Users as UsersIcon } from "lucide-react";
import { useMemo } from "react";
import { Avatar, Badge, Button, EmptyState, NativeSelect, TextInput } from "@/components/kit";
import { AdminHeader, AdminPage, DataTable, FilterBar, FilterTabs, anySearch, pageOf, useSortParam, useUrlParams } from "@/components/admin/kit";
import { dateShort, userStatus, useAdminModel, type AdminUser } from "@/lib/admin-data";
import { money } from "@/lib/format";

export const Route = createFileRoute("/admin/users/")({
  validateSearch: anySearch,
  head: () => ({ meta: [{ title: "Users · Admin · OwnerFi" }] }),
  component: UsersPage,
});

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "verified", label: "Verified" },
  { value: "in_review", label: "In review" },
  { value: "suspended", label: "Suspended" },
];
const SIZE = 12;

function UsersPage() {
  const m = useAdminModel();
  const navigate = useNavigate();
  const { params, set, clear } = useUrlParams();
  const sort = useSortParam("-joined", ["joined", "volume"]);
  const role = (["seller", "buyer"] as const).find((r) => r === params.get("role")) ?? "all";
  const status = STATUSES.find((s) => s.value === params.get("status"))?.value ?? "all";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const people = useMemo(() => m.users.filter((u) => u.role !== "admin"), [m.users]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people
      .filter((u) => role === "all" || u.role === role)
      .filter((u) => (status === "all" ? true : status === "suspended" ? u.status === "suspended" : status === "verified" ? userStatus(u).label === "Verified" : userStatus(u).label === "In review"))
      .filter((u) => !needle || `${u.name} ${u.email} ${u.phone} ${u.state}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const d = sort.sortKey === "volume" ? a.volume - b.volume : a.createdAt.localeCompare(b.createdAt);
        return sort.sortDir === "asc" ? d : -d;
      });
  }, [people, role, status, q, sort.sortKey, sort.sortDir]);
  const counts = { all: people.length, seller: people.filter((u) => u.role === "seller").length, buyer: people.filter((u) => u.role === "buyer").length };
  const filtering = role !== "all" || status !== "all" || q !== "";

  return (
    <AdminPage>
      <AdminHeader title="Users" description="Everyone who buys or sells on OwnerFi." />
      <FilterTabs
        idPrefix="users"
        value={role}
        onChange={(v) => set({ role: v === "all" ? null : v })}
        className="mb-4"
        items={[
          { id: "all", label: "All", count: counts.all },
          { id: "seller", label: "Sellers", count: counts.seller },
          { id: "buyer", label: "Buyers", count: counts.buyer },
        ]}
      />
      <FilterBar>
        <TextInput label="Search" placeholder="Name, email, phone or state" wrapperClassName="w-full sm:w-72" leftAdornment={<Search aria-hidden className="h-4 w-4" />} value={q} onChange={(e) => set({ q: e.target.value })} />
        <NativeSelect label="Status" className="sm:w-48" value={status} onChange={(e) => set({ status: e.target.value === "all" ? null : e.target.value })} options={STATUSES} />
      </FilterBar>
      <DataTable<AdminUser>
        caption="Users"
        rows={pageOf(filtered, page, SIZE)}
        total={filtered.length}
        page={page}
        pageSize={SIZE}
        onPageChange={(p) => set({ page: String(p) })}
        getRowId={(u) => u.id}
        sortKey={sort.sortKey}
        sortDir={sort.sortDir}
        onSort={sort.onSort}
        columns={[
          {
            key: "person",
            header: "Person",
            render: (u) => (
              <button type="button" onClick={() => navigate({ to: "/admin/users/$id", params: { id: u.id } })} className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Avatar name={u.name} size="sm" />
                <span>
                  <span className={u.status === "suspended" ? "block font-semibold text-muted" : "block font-semibold text-ink"}>{u.name}</span>
                  <span className="block text-muted">{u.email}</span>
                </span>
              </button>
            ),
          },
          { key: "role", header: "Role", render: (u) => <Badge tone="neutral">{u.role === "seller" ? "Seller" : "Buyer"}</Badge> },
          { key: "state", header: "State", render: (u) => u.state },
          { key: "joined", header: "Joined", sortable: true, render: (u) => dateShort(u.createdAt) },
          { key: "status", header: "Verification", render: (u) => <Badge tone={userStatus(u).tone}>{userStatus(u).label}</Badge> },
          { key: "deals", header: "Deals", align: "right", render: (u) => u.deals },
          { key: "volume", header: "Volume", sortable: true, align: "right", render: (u) => (u.volume ? money(u.volume / 100) : "—") },
        ]}
        emptyState={
          <EmptyState
            icon={<UsersIcon aria-hidden className="h-6 w-6" />}
            title="No one matches"
            description="Try a different search or filter."
            action={filtering ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined}
          />
        }
      />
    </AdminPage>
  );
}
