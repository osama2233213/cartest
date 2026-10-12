import { Outlet, createFileRoute } from "@tanstack/react-router";

// Pass-through layout so /cars/:id (the car) and /cars/:id/offer (the offer flow) are siblings.
export const Route = createFileRoute("/cars/$id")({
  component: Outlet,
});
