import { Badge } from "@/components/kit";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";
const t = (label: string, tone: Tone) => ({ label, tone });

const MAPS = {
  deal: {
    inquiry: t("Asking questions", "neutral"),
    test_drive: t("Test drive", "primary"),
    application: t("Offer sent", "primary"),
    negotiation: t("Negotiating", "primary"),
    inspection: t("Inspection", "primary"),
    contract: t("Signing", "primary"),
    down_payment: t("Down payment", "warning"),
    closing: t("Closing at the DMV", "warning"),
    active: t("Active", "success"),
    paid_off: t("Paid off", "success"),
    declined: t("Declined", "neutral"),
    cancelled: t("Cancelled", "neutral"),
    defaulted: t("Defaulted", "danger"),
  },
  vehicle: {
    draft: t("Draft", "neutral"),
    verifying: t("Checking", "warning"),
    blocked: t("Blocked", "danger"),
    pending_review: t("In review", "warning"),
    listed: t("Listed", "success"),
    reserved: t("Reserved", "primary"),
    sold_active: t("Sold — paying", "success"),
    paid_off: t("Paid off", "success"),
    delisted: t("Not listed", "neutral"),
  },
  verification: {
    not_started: t("Not started", "neutral"),
    in_progress: t("In progress", "warning"),
    in_review: t("In review", "warning"),
    verified: t("Verified", "success"),
    rejected: t("Rejected", "danger"),
  },
  check: {
    pending: t("Waiting", "neutral"),
    running: t("Checking", "warning"),
    pass: t("Clear", "success"),
    fail: t("Problem found", "danger"),
    review: t("Needs a look", "warning"),
  },
  adChannel: {
    draft: t("Draft", "neutral"),
    queued: t("Queued", "warning"),
    posting: t("Posting", "warning"),
    live: t("Live", "success"),
    failed: t("Failed", "danger"),
    paused: t("Paused", "neutral"),
    expired: t("Expired", "neutral"),
  },
  testDrive: {
    requested: t("Requested", "warning"),
    confirmed: t("Confirmed", "success"),
    declined: t("Declined", "neutral"),
    rescheduled: t("Rescheduled", "warning"),
    completed: t("Done", "success"),
    no_show: t("No-show", "danger"),
    cancelled: t("Cancelled", "neutral"),
  },
  payment: {
    scheduled: t("Scheduled", "neutral"),
    processing: t("Processing", "warning"),
    paid: t("Paid", "success"),
    failed: t("Failed", "danger"),
    late: t("Late", "danger"),
    refunded: t("Refunded", "neutral"),
  },
  offer: {
    pending: t("Waiting", "warning"),
    countered: t("Countered", "primary"),
    accepted: t("Accepted", "success"),
    declined: t("Declined", "neutral"),
    withdrawn: t("Withdrawn", "neutral"),
  },
  inspection: {
    not_scheduled: t("Not booked", "neutral"),
    requested: t("Requested", "warning"),
    scheduled: t("Booked", "primary"),
    in_progress: t("In progress", "warning"),
    report_ready: t("Report ready", "success"),
  },
  dispute: {
    needs_response: t("Reply needed", "danger"),
    under_review: t("Under review", "warning"),
    won: t("Won", "success"),
    lost: t("Lost", "neutral"),
  },
  partner: {
    connected: t("Connected", "success"),
    needs_attention: t("Needs attention", "warning"),
    disabled: t("Off", "neutral"),
  },
  integration: {
    healthy: t("Healthy", "success"),
    degraded: t("Slow", "warning"),
    down: t("Down", "danger"),
  },
  ticket: {
    open: t("Open", "primary"),
    waiting: t("Waiting on user", "neutral"),
    solved: t("Solved", "success"),
  },
  ticketPriority: {
    low: t("Low", "neutral"),
    normal: t("Normal", "neutral"),
    high: t("High", "warning"),
    urgent: t("Urgent", "danger"),
  },
} as const;

export type StatusKind = keyof typeof MAPS;

export function statusInfo(kind: StatusKind, value: string): { label: string; tone: Tone } {
  const map = MAPS[kind] as Record<string, { label: string; tone: Tone }>;
  return map[value] ?? { label: value.replace(/_/g, " "), tone: "neutral" };
}

export function StatusChip({ kind, value }: { kind: StatusKind; value: string }) {
  const s = statusInfo(kind, value);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
