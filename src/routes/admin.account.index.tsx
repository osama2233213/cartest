import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/account/")({
  component: () => <Navigate to="/admin/account/$section" params={{ section: "profile" }} replace />,
});
