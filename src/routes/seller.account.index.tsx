import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/seller/account/")({
  component: () => <Navigate to="/seller/account/$section" params={{ section: "profile" }} replace />,
});
