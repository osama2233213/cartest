import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/seller/test-drives")({
  component: Outlet,
});
