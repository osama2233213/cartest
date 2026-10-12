import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/components/app/NotificationsPage";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Admin · OwnerFi" }] }),
  component: () => <NotificationsPage role="admin" />,
});
