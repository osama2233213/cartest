import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings/")({
  component: () => <Navigate to="/admin/settings/$tab" params={{ tab: "fees" }} replace />,
});
