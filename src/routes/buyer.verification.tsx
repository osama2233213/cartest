import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/buyer/verification")({
  component: Outlet,
});
