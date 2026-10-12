import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/seller/deals/$dealId")({
  component: Outlet,
});
