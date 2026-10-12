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
const DUE_KEY = "ownerfi-poc-identity-due-v1";

const readJson = <T>(key: string): Record<string, T> => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, T>;
  } catch {
    return {};
  }
};
const writeJson = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

/**
 * Remembers the outcome per person across a reload while the check is running, and when it is due.
 * The check finishes in the background (see `dueDecisions`), so it completes even if the person leaves the page.
 */
export function saveOutcome(userId: string, outcome: IdentityOutcome, now = Date.now()) {
  writeJson(KEY, { ...readJson<IdentityOutcome>(KEY), [userId]: outcome });
  writeJson(DUE_KEY, { ...readJson<number>(DUE_KEY), [userId]: now + IDENTITY_APPROVE_MS });
}

/** Checks whose time is up and that no person has to decide ("review" waits for a person). */
export function dueDecisions(now = Date.now()): { userId: string; outcome: Exclude<IdentityOutcome, "review"> }[] {
  const due = readJson<number>(DUE_KEY);
  const outcomes = readJson<IdentityOutcome>(KEY);
  return Object.entries(due)
    .filter(([userId, at]) => at <= now && outcomes[userId] !== "review")
    .map(([userId]) => ({ userId, outcome: (outcomes[userId] ?? "approved") as Exclude<IdentityOutcome, "review"> }));
}

/** Forget a finished check. */
export function clearDue(userId: string) {
  const { [userId]: _done, ...rest } = readJson<number>(DUE_KEY);
  writeJson(DUE_KEY, rest);
}

export function loadOutcome(userId: string): IdentityOutcome {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, IdentityOutcome>)[userId] ?? "approved";
  } catch {
    return "approved";
  }
}
