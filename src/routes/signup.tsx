import { createFileRoute, redirect } from "@tanstack/react-router";

// Old URL kept alive: the app now signs up at /auth/signup.
export const Route = createFileRoute("/signup")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/signup", search: {}, replace: true });
  },
});
