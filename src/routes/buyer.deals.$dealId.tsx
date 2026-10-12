import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/buyer/deals/$dealId")({
  component: Outlet,
});
