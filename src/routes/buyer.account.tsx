import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/buyer/account")({
  component: Outlet,
});
