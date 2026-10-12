import type { Role } from "./demo-data";

export const PORTAL: Record<Role, { first: string; full: string; label: string; home: string }> = {
  seller: { first: "Maria", full: "Maria Alvarez", label: "Seller", home: "/seller" },
  buyer: { first: "Daniel", full: "Daniel Park", label: "Buyer", home: "/buyer" },
  admin: { first: "Sam", full: "Sam Rivera", label: "Admin", home: "/admin" },
};
