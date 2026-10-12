import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/buyer/account/")({
  component: () => <Navigate to="/buyer/account/$section" params={{ section: "profile" }} replace />,
});
