import { Navigate, createFileRoute } from "@tanstack/react-router";

// /seller/vehicles/new starts the wizard at the VIN step.
export const Route = createFileRoute("/seller/vehicles/new/")({
  component: () => <Navigate to="/seller/vehicles/new/$step" params={{ step: "vin" }} replace />,
});
