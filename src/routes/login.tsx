import { createFileRoute, redirect } from "@tanstack/react-router";

// Old URL kept alive: the app now logs in at /auth/login.
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/login", search: {}, replace: true });
  },
});
