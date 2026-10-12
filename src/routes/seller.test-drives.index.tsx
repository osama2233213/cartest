import { createFileRoute } from "@tanstack/react-router";
import { addDays } from "date-fns/addDays";
import { format } from "date-fns/format";
import { isSameDay } from "date-fns/isSameDay";
import { startOfWeek } from "date-fns/startOfWeek";
import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Alert,
  AppLink,
  Avatar,
  Button,
  ButtonLink,
  EmptyState,
  Modal,
  PageHeader,
  Segmented,
  useToast,
} from "@/components/kit";
import { Calendar, ReasonDialog, TimeSlots, sameDay } from "@/components/kit-extra";
import { StatusChip } from "@/components/status";
import { OPEN, dayKey, openSlots, setDriveStatus, useAvailability, useDrives, type Drive } from "@/lib/drives";
import { useCurrentUser } from "@/lib/session";
import { notify } from "@/lib/notify";
import { uidOf } from "@/lib/demo-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/test-drives/")({
  validateSearch: (s: Record<string, unknown>): { view?: "week" } => (s["view"] === "week" ? { view: "week" } : {}),
  head: () => ({ meta: [{ title: "Test drives · OwnerFi" }] }),
  component: TestDrives,
});

const when = (iso: string) => format(new Date(iso), "EEE, MMM d · h:mm a");
const first = (n: string) => n.split(" ")[0] ?? n;

type Kind = "accept" | "decline" | "cancel" | "complete" | "noshow" | "reschedule";

function Actions({ d, onAct }: { d: Drive; onAct: (k: Kind, d: Drive) => void }) {
  const b = (k: Kind, label: string, variant: "primary" | "secondary" | "ghost" = "secondary") => (
    <Button key={k} size="sm" variant={variant} onClick={() => onAct(k, d)}>
      {label}
    </Button>
  );
  const past = new Date(d.start) < new Date();
  if (d.status === "requested") return <div className="flex flex-wrap gap-2">{b("accept", "Accept", "primary")}{b("reschedule", "Suggest another time")}{b("decline", "Decline", "ghost")}</div>;
  if (d.status === "confirmed")
    return (
      <div className="flex flex-wrap gap-2">
        {past ? (
          <>
            {b("complete", "Mark as done", "primary")}
            {b("noshow", "No-show")}
          </>
        ) : (
          <>
            {b("reschedule", "Suggest another time")}
            {b("cancel", "Cancel", "ghost")}
          </>
        )}
      </div>
    );
  if (d.status === "rescheduled") return <p className="text-sm text-muted">Waiting for the buyer to answer.</p>;
  return null;
}

function Row({ d, onAct, onOpen }: { d: Drive; onAct: (k: Kind, d: Drive) => void; onOpen: (d: Drive) => void }) {
  const done = ["completed", "no_show", "cancelled", "declined"].includes(d.status);
  return (
    <li className="rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex items-start gap-3">
        <Avatar name={d.buyerName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onOpen(d)} className="font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {d.buyerName}
            </button>
            <StatusChip kind="testDrive" value={d.status} />
          </div>
          <p className="text-muted">{d.car}</p>
          <p className="num font-medium">{when(d.start)}</p>
          {d.note && <p className="mt-1 text-sm text-muted">“{d.note}”</p>}
        </div>
      </div>
      <div className="mt-3">{done ? <AppLink to="/seller/inbox" className="text-sm font-semibold text-primary hover:underline">Open chat</AppLink> : <Actions d={d} onAct={onAct} />}</div>
    </li>
  );
}

function Group({ title, rows, empty, children, onAct, onOpen }: { title: string; rows: Drive[]; empty: string; children?: ReactNode; onAct: (k: Kind, d: Drive) => void; onOpen: (d: Drive) => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold leading-7 md:text-2xl md:leading-8">{title}</h2>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 p-5 text-muted">
          <p>{empty}</p>
          {children}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => (
            <Row key={d.id} d={d} onAct={onAct} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- week view */

const HOUR0 = 7;
const PX = 48;

function Week({ rows, onOpen }: { rows: Drive[]; onOpen: (d: Drive) => void }) {
  const av = useAvailability();
  const [start, setStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [day, setDay] = useState(() => (new Date().getDay() + 6) % 7);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const shown = rows.filter((r) => [...OPEN, "completed"].includes(r.status));
  const on = (d: Date) => shown.filter((r) => isSameDay(new Date(r.start), d));
  const hours = Array.from({ length: 14 }, (_, i) => HOUR0 + i);
  const ranges = (d: Date) => (av.blackout.includes(dayKey(d)) ? [] : (av.weekly.find((w) => w.day === d.getDay())?.ranges ?? []));
  const mins = (t: string) => Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]);
  const y = (m: number) => Math.max(0, ((m - HOUR0 * 60) / 60) * PX);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p aria-live="polite" className="font-semibold">
          {format(days[0]!, "MMM d")} – {format(days[6]!, "MMM d, yyyy")}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}>
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
              setDay((new Date().getDay() + 6) % 7);
            }}
          >
            Today
          </Button>
          <Button size="sm" variant="secondary" aria-label="Next week" onClick={() => setStart(addDays(start, 7))}>
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-ink/10 bg-white md:grid md:grid-cols-[3.5rem_repeat(7,1fr)]">
        <div />
        {days.map((d) => (
          <div key={dayKey(d)} className={cn("border-l border-ink/10 py-2 text-center text-sm", isSameDay(d, new Date()) && "font-bold text-primary")}>
            {format(d, "EEE d")}
          </div>
        ))}
        <div className="relative" style={{ height: hours.length * PX }}>
          {hours.map((h) => (
            <span key={h} className="num absolute right-2 -translate-y-2 text-xs text-muted" style={{ top: (h - HOUR0) * PX }}>
              {format(new Date(2000, 0, 1, h), "h a")}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={dayKey(d)} className="relative border-l border-ink/10" style={{ height: hours.length * PX }}>
            {hours.map((h) => (
              <div key={h} className="absolute inset-x-0 border-t border-ink/5" style={{ top: (h - HOUR0) * PX }} />
            ))}
            {ranges(d).map((r) => (
              <div key={r.from} aria-hidden className="absolute inset-x-0 bg-surface" style={{ top: y(mins(r.from)), height: ((mins(r.to) - mins(r.from)) / 60) * PX }} />
            ))}
            {on(d).map((r) => {
              const t = new Date(r.start);
              const pending = r.status === "requested" || r.status === "rescheduled";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onOpen(r)}
                  style={{ top: y(t.getHours() * 60 + t.getMinutes()), height: Math.max(28, (r.durationMin / 60) * PX - 2) }}
                  className={cn(
                    "absolute inset-x-0.5 overflow-hidden rounded-lg px-1.5 py-0.5 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    pending ? "border-2 border-primary bg-white text-primary" : "bg-primary text-white",
                  )}
                >
                  {format(t, "h:mm a")} · {first(r.buyerName)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="md:hidden">
        <div role="tablist" aria-label="Day of the week" className="mb-3 flex gap-1 overflow-x-auto">
          {days.map((d, i) => (
            <button
              key={dayKey(d)}
              type="button"
              role="tab"
              aria-selected={i === day}
              onClick={() => setDay(i)}
              className={cn("num min-w-12 rounded-xl px-2 py-2 text-center text-sm", i === day ? "bg-primary font-semibold text-white" : "bg-surface")}
            >
              <span className="block text-xs">{format(d, "EEE")}</span>
              {format(d, "d")}
            </button>
          ))}
        </div>
        <p className="mb-2 text-sm text-muted">
          {ranges(days[day]!).length ? `Open ${ranges(days[day]!).map((r) => `${r.from}–${r.to}`).join(", ")}` : "You’re not available this day."}
        </p>
        {on(days[day]!).length === 0 ? (
          <p className="rounded-2xl border border-ink/10 bg-white p-4 text-muted">No test drives this day.</p>
        ) : (
          <ul className="space-y-2">
            {on(days[day]!).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r)} className="w-full rounded-2xl border border-ink/10 bg-white p-3 text-left">
                  <span className="num font-semibold">{format(new Date(r.start), "h:mm a")}</span> · {r.buyerName}
                  <span className="block text-sm text-muted">{r.status === "confirmed" || r.status === "completed" ? "Confirmed" : "Waiting for a reply"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- page */

function TestDrives() {
  const user = useCurrentUser();
  const toast = useToast();
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const all = useDrives();
  const av = useAvailability();
  const mine = useMemo(() => all.filter((d) => d.sellerName === user?.name).sort((a, b) => a.start.localeCompare(b.start)), [all, user?.name]);
  const [open, setOpen] = useState<Drive | null>(null);
  const [dialog, setDialog] = useState<{ kind: Kind; d: Drive } | null>(null);
  const [newTime, setNewTime] = useState<{ day: Date | null; time: string | null }>({ day: null, time: null });

  const now = new Date();
  const groups = {
    requests: mine.filter((d) => d.status === "requested"),
    upcoming: mine.filter((d) => (d.status === "confirmed" || d.status === "rescheduled") && new Date(d.start) >= new Date(now.getTime() - 3_600_000)),
    past: mine.filter((d) => !["requested", "confirmed", "rescheduled"].includes(d.status) || new Date(d.start) < new Date(now.getTime() - 3_600_000)).filter((d) => !["requested"].includes(d.status)),
  };
  const pastIds = new Set(groups.past.map((d) => d.id));
  groups.upcoming = groups.upcoming.filter((d) => !pastIds.has(d.id));

  const slots = dialog?.kind === "reschedule" ? openSlots(av, all, new Date(), new Date(Date.now() + 30 * 86_400_000)) : [];

  // Tells the buyer of a drive (the right buyer, not just the demo one).
  const tellBuyer = (d: Drive, title: string, body: string) => notify(uidOf(d.buyerName), "test_drive", { title, body, href: "/buyer/test-drives" });

  const act = (kind: Kind, d: Drive) => {
    if (kind === "accept") {
      setDriveStatus(d.id, "confirmed");
      tellBuyer(d, "Your test drive is confirmed", `${first(d.sellerName)} confirmed ${when(d.start)}.`);
      toast({ tone: "success", title: `Confirmed. ${first(d.buyerName)} can now see where to meet.` });
    } else if (kind === "noshow") {
      setDriveStatus(d.id, "no_show");
      toast({ tone: "success", title: "Marked as a no-show" });
    } else {
      setNewTime({ day: null, time: null });
      setDialog({ kind, d });
    }
  };

  const done = (msg: string) => {
    setDialog(null);
    setOpen(null);
    toast({ tone: "success", title: msg });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Test drives"
        description="Answer requests and see who is coming."
        action={<ButtonLink variant="secondary" to="/seller/test-drives/availability">Set my availability</ButtonLink>}
      />
      <Alert className="mb-5" title="Stay safe">
        Meet in a public place. Your buyer is ID-verified. Never hand over the title or keys before you’re paid.
      </Alert>
      {mine.length === 0 ? (
        <EmptyState
          icon={<CalendarDays aria-hidden className="h-6 w-6" />}
          title="No test drives yet"
          description="Buyers can book a time once your car is listed. Share your ad to get more."
          action={<ButtonLink to="/seller/vehicles">Advertise a car</ButtonLink>}
        />
      ) : (
        <>
          <Segmented
            label="View"
            className="mb-5"
            value={view ?? "list"}
            options={[
              { value: "list", label: "List" },
              { value: "week", label: "Week" },
            ]}
            onChange={(v) => navigate({ search: (v === "week" ? { view: "week" } : {}) as never, replace: true })}
          />
          {view === "week" ? (
            <Week rows={mine} onOpen={setOpen} />
          ) : (
            <div className="space-y-8">
              <Group title="Requests" rows={groups.requests} empty="No requests right now. Share your ad to get more." onAct={act} onOpen={setOpen}>
                <ButtonLink className="mt-3" size="sm" variant="secondary" to="/seller/vehicles">Advertise a car</ButtonLink>
              </Group>
              <Group title="Upcoming" rows={groups.upcoming} empty="Nothing booked yet." onAct={act} onOpen={setOpen} />
              <Group title="Past" rows={groups.past} empty="Finished drives show up here." onAct={act} onOpen={setOpen} />
            </div>
          )}
        </>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title="Test drive">
        {open && (
          <div className="space-y-4">
            <StatusChip kind="testDrive" value={open.status} />
            <dl className="space-y-3">
              {[
                ["When", when(open.start)],
                ["Buyer", open.buyerName],
                ["Car", open.car],
                ["Where", open.place],
                ...(open.note ? [["Note", open.note]] : []),
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <Actions d={open} onAct={(k, d) => { setOpen(null); act(k, d); }} />
            <AppLink to="/seller/inbox" className="block text-sm font-semibold text-primary hover:underline">Open chat</AppLink>
          </div>
        )}
      </Modal>

      {dialog?.kind === "decline" && (
        <ReasonDialog
          title={`Decline ${first(dialog.d.buyerName)}’s request?`}
          description={`We’ll tell ${first(dialog.d.buyerName)} and they can pick another time.`}
          confirmLabel="Decline"
          danger
          reasons={["Can’t make that time", "Car isn’t available", "Other"]}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setDriveStatus(dialog.d.id, "declined");
            tellBuyer(dialog.d, "Your test drive request was declined", `${first(dialog.d.sellerName)} can’t do that time for the ${dialog.d.car}. Pick another time.`);
            done("Request declined");
          }}
        />
      )}
      {dialog?.kind === "cancel" && (
        <ReasonDialog
          title="Cancel this test drive?"
          description={`We’ll tell ${first(dialog.d.buyerName)} right away.`}
          confirmLabel="Cancel drive"
          danger
          reasons={["Something came up", "Car was sold", "Other"]}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setDriveStatus(dialog.d.id, "cancelled");
            tellBuyer(dialog.d, "Your test drive was cancelled", `${first(dialog.d.sellerName)} cancelled the test drive for the ${dialog.d.car}. You can book another time.`);
            done("Test drive cancelled");
          }}
        />
      )}
      {dialog?.kind === "complete" && (
        <ReasonDialog
          title="Did the test drive happen?"
          description={`${first(dialog.d.buyerName)} will be asked to make an offer.`}
          confirmLabel="Yes, mark as done"
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setDriveStatus(dialog.d.id, "completed");
            tellBuyer(dialog.d, "How was the test drive?", `Liked the ${dialog.d.car}? You can make an offer now.`);
            done("Marked as done");
          }}
        />
      )}
      {dialog?.kind === "reschedule" && (
        <Modal
          open
          onClose={() => setDialog(null)}
          title="Suggest another time"
          description={`${first(dialog.d.buyerName)} gets your new time and can accept it or pick another.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                disabled={!newTime.time}
                onClick={() => {
                  setDriveStatus(dialog.d.id, "rescheduled", { start: newTime.time! });
                  tellBuyer(dialog.d, "A new test drive time was suggested", `${first(dialog.d.sellerName)} suggests ${when(newTime.time!)} for the ${dialog.d.car}. Accept it or pick another.`);
                  done(`New time sent to ${first(dialog.d.buyerName)}`);
                }}
              >
                Send new time
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Calendar
              value={newTime.day}
              onChange={(d) => setNewTime({ day: d, time: null })}
              minDate={new Date(Date.now() + 86_400_000)}
              availableDates={slots}
              disabledDate={(d) => !slots.some((s) => sameDay(s, d))}
              className="max-w-none"
            />
            {newTime.day ? (
              <TimeSlots
                label={`Times on ${format(newTime.day, "EEEE, MMM d")}`}
                slots={slots.filter((s) => sameDay(s, newTime.day!)).map((s) => ({ id: s.toISOString(), label: format(s, "h:mm a") }))}
                value={newTime.time}
                onChange={(t) => setNewTime((n) => ({ ...n, time: t }))}
              />
            ) : (
              <p className="text-sm text-muted">Pick a day with a dot to see times.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
