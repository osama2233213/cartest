import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · OwnerFi" }] }),
  component: AdminLayout,
});
