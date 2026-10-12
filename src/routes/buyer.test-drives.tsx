import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { useMemo, useState } from "react";
import { CalendarPlus, CalendarDays, MapPin } from "lucide-react";
import { Alert, AppLink, Button, ButtonLink, Card, EmptyState, Modal, PageHeader, Tooltip, useToast } from "@/components/kit";
import { Calendar, ReasonDialog, TimeSlots, sameDay } from "@/components/kit-extra";
import { CarImage } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { useBuyerDrives } from "@/lib/buyer-data";
import { liveSettings } from "@/lib/live-settings";
import { OPEN, openSlots, setDriveStatus, useAvailability, useDrives, type Drive } from "@/lib/drives";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/lib/demo-store";

export const Route = createFileRoute("/buyer/test-drives")({
  head: () => ({ meta: [{ title: "Test drives · OwnerFi" }] }),
  component: BuyerTestDrives,
});

const when = (iso: string) => format(new Date(iso), "EEE, MMM d · h:mm a");

const ics = (d: Drive) => {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(new Date(d.start).getTime() + d.durationMin * 60_000).toISOString();
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OwnerFi//Test drive//EN",
    "BEGIN:VEVENT",
    `UID:${d.id}@ownerfi.demo`,
    `DTSTAMP:${f(new Date().toISOString())}`,
    `DTSTART:${f(d.start)}`,
    `DTEND:${f(end)}`,
    `SUMMARY:${esc(`Test drive: ${d.car}`)}`,
    `LOCATION:${esc(d.place)}`,
    "DESCRIPTION:Bring your driver’s licence. Meet in a public place.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
};

function download(d: Drive) {
  const url = URL.createObjectURL(new Blob([ics(d)], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "test-drive.ics";
  a.click();
  URL.revokeObjectURL(url);
}

function DriveCard({
  d,
  dismissed,
  onAct,
}: {
  d: Drive;
  dismissed: boolean;
  onAct: (k: "reschedule" | "cancel" | "accept" | "notForMe", d: Drive) => void;
}) {
  const { deals } = useDemoStore();
  const photo = deals.find((x) => x.id === d.dealId)?.photo;
  const seller = d.sellerName.split(" ")[0];
  const open = OPEN.includes(d.status);
  // The free-change window is the admin's setting (24 hours until they change it).
  const cancelHours = liveSettings().testDriveCancelHours;
  const locked = d.status === "confirmed" && new Date(d.start).getTime() - Date.now() < cancelHours * 3_600_000;
  const note = `Free to change up to ${cancelHours} hours before. After that, message ${seller}.`;
  const btn = (label: string, kind: "reschedule" | "cancel", variant: "secondary" | "ghost") => {
    const b = (
      <Button size="sm" variant={variant} disabled={locked} onClick={() => onAct(kind, d)}>
        {label}
      </Button>
    );
    return locked ? <Tooltip content={note}>{b}</Tooltip> : b;
  };
  return (
    <li className="rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex gap-3">
        <CarImage src={photo} alt={d.car} className="h-16 w-20 shrink-0 !rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{d.car}</p>
            <StatusChip kind="testDrive" value={d.status} />
          </div>
          <p className="num font-medium">{when(d.start)}</p>
          <p className="text-sm text-muted">With {d.sellerName}</p>
        </div>
      </div>
      {d.status === "requested" && <p className="mt-3 text-muted">Waiting for {seller} to confirm. We’ll message you.</p>}
      {d.status === "confirmed" && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface p-3">
          <MapPin aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">{d.place}</p>
            <p className="text-sm text-muted">Bring your driver’s licence.</p>
          </div>
        </div>
      )}
      {d.status === "rescheduled" && (
        <Alert tone="info" className="mt-3" title={`${seller} suggests ${when(d.start)}`}>
          Accept it, or pick a time that works better.
        </Alert>
      )}
      {d.status === "completed" && !dismissed && (
        <Alert
          tone="success"
          className="mt-3"
          title="How did it go?"
          action={
            <div className="flex gap-2">
              {d.vehicleId && <ButtonLink size="sm" to={`/cars/${d.vehicleId}/offer`}>Make an offer</ButtonLink>}
              <Button size="sm" variant="ghost" onClick={() => onAct("notForMe", d)}>
                Not for me
              </Button>
            </div>
          }
        >
          Liked the car? Make an offer. It takes a few minutes.
        </Alert>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {d.status === "confirmed" && (
          <Button size="sm" variant="secondary" leftIcon={<CalendarPlus aria-hidden className="h-4 w-4" />} onClick={() => download(d)}>
            Add to calendar
          </Button>
        )}
        {d.status === "rescheduled" && (
          <Button size="sm" onClick={() => onAct("accept", d)}>
            Accept this time
          </Button>
        )}
        {open && btn(d.status === "rescheduled" ? "Pick another time" : "Reschedule", "reschedule", "secondary")}
        {open && btn("Cancel", "cancel", "ghost")}
        <AppLink to="/buyer/inbox" className="text-sm font-semibold text-primary hover:underline">
          Message {seller}
        </AppLink>
      </div>
      {open && <p className="mt-2 text-sm text-muted">{note}</p>}
    </li>
  );
}

function BuyerTestDrives() {
  const toast = useToast();
  const { changeTestDrive } = useDemoStore();
  const mine = useBuyerDrives();
  const all = useDrives();
  const av = useAvailability();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [resched, setResched] = useState<Drive | null>(null);
  const [cancel, setCancel] = useState<Drive | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const upcoming = mine.filter((d) => OPEN.includes(d.status) && new Date(d.start) >= new Date(Date.now() - 3_600_000));
  const past = mine.filter((d) => !upcoming.includes(d)).reverse();
  const slots = useMemo(
    () => (resched ? openSlots(av, all.filter((d) => d.sellerName === resched.sellerName && d.id !== resched.id), new Date(), new Date(Date.now() + 30 * 86_400_000)) : []),
    [resched, av, all],
  );

  const act = (k: "reschedule" | "cancel" | "accept" | "notForMe", d: Drive) => {
    if (k === "reschedule") {
      setDay(null);
      setTime(null);
      setResched(d);
    } else if (k === "cancel") setCancel(d);
    else if (k === "notForMe") setDismissed((x) => [...x, d.id]);
    else {
      setDriveStatus(d.id, "confirmed");
      toast({ tone: "success", title: "Confirmed. See you there." });
    }
  };

  const list = (rows: Drive[], empty: React.ReactNode) =>
    rows.length === 0 ? (
      empty
    ) : (
      <ul className="space-y-4">
        {rows.map((d) => (
          <DriveCard key={d.id} d={d} dismissed={dismissed.includes(d.id)} onAct={act} />
        ))}
      </ul>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Test drives" description="Your visits to see cars in person." />
      <div role="tablist" className="scrollbar-none flex gap-1 overflow-x-auto border-b border-ink/10">
        {(
          [
            ["upcoming", "Upcoming", upcoming.length],
            ["past", "Past", past.length],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold md:px-4", tab === id ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {label}
            <span className={cn("num rounded-full px-2 text-xs leading-5", tab === id ? "bg-primary text-white" : "bg-ink/[0.07] text-ink/70")}>{n}</span>
          </button>
        ))}
      </div>
      <div className="pt-5">
        {tab === "upcoming"
          ? list(
              upcoming,
              <Card>
                <EmptyState
                  icon={<CalendarDays aria-hidden className="h-6 w-6" />}
                  title="No test drives planned"
                  description="Find a car you like and book a time to see it."
                  action={<ButtonLink to="/cars">Browse cars</ButtonLink>}
                />
              </Card>,
            )
          : list(past, <p className="text-muted">Nothing yet. Finished drives show up here.</p>)}
      </div>

      {resched && (
        <Modal
          open
          onClose={() => setResched(null)}
          title="Pick a new time"
          description={`${resched.sellerName.split(" ")[0]} will confirm.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setResched(null)}>
                Cancel
              </Button>
              <Button
                disabled={!time}
                onClick={() => {
                  setDriveStatus(resched.id, "requested", { start: time! });
                  if (resched.dealId) changeTestDrive(resched.dealId, { kind: "rescheduled", slot: when(time!) });
                  setResched(null);
                  toast({ tone: "success", title: "New time sent" });
                }}
              >
                Send new time
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Calendar
              value={day}
              onChange={(d) => {
                setDay(d);
                setTime(null);
              }}
              minDate={new Date(Date.now() + 86_400_000)}
              availableDates={slots}
              disabledDate={(d) => !slots.some((s) => sameDay(s, d))}
              className="max-w-none"
            />
            {day ? (
              <TimeSlots
                label={`Times on ${format(day, "EEEE, MMM d")}`}
                slots={slots.filter((s) => sameDay(s, day)).map((s) => ({ id: s.toISOString(), label: format(s, "h:mm a") }))}
                value={time}
                onChange={setTime}
              />
            ) : (
              <p className="text-sm text-muted">Pick a day with a dot to see times.</p>
            )}
          </div>
        </Modal>
      )}
      {cancel && (
        <ReasonDialog
          title="Cancel this test drive?"
          description={`We’ll tell ${cancel.sellerName.split(" ")[0]} right away.`}
          confirmLabel="Cancel drive"
          danger
          reasons={["Found another car", "Can’t make it", "Other"]}
          onClose={() => setCancel(null)}
          onConfirm={(reason) => {
            setDriveStatus(cancel.id, "cancelled", { cancelReason: reason });
            if (cancel.dealId) changeTestDrive(cancel.dealId, { kind: "cancelled", reason });
            setCancel(null);
            toast({ tone: "success", title: "Test drive cancelled" });
          }}
        />
      )}
    </div>
  );
}
