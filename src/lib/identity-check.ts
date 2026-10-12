/**
 * Mock ID check. The outcome comes from the uploaded file names, so every result can be tried:
 * a name with "reject" is rejected, a name with "review" goes to the manual queue, anything else is approved after a few seconds.
 */
export type IdentityOutcome = "approved" | "rejected" | "review";

export const IDENTITY_APPROVE_MS = 3000;

export function identityOutcome(fileNames: (string | undefined)[]): IdentityOutcome {
  const names = fileNames.filter(Boolean).map((n) => n!.toLowerCase());
  if (names.some((n) => n.includes("reject"))) return "rejected";
  if (names.some((n) => n.includes("review"))) return "review";
  return "approved";
}

const KEY = "ownerfi-poc-identity-outcome-v1";

/** Remembers the outcome per person across a reload while the check is running. */
export function saveOutcome(userId: string, outcome: IdentityOutcome) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, IdentityOutcome>;
    localStorage.setItem(KEY, JSON.stringify({ ...all, [userId]: outcome }));
  } catch {
    /* ignore */
  }
}

export function loadOutcome(userId: string): IdentityOutcome {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, IdentityOutcome>)[userId] ?? "approved";
  } catch {
    return "approved";
  }
}
