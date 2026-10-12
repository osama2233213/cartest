import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/seller/vehicles/new")({
  component: Outlet,
});
