import { Link, createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { Button, Card, CardHeader, Checkbox, NativeSelect, PageHeader, Segmented, TextArea, useToast } from "@/components/kit";
import { Calendar } from "@/components/kit-extra";
import {
  availabilityErrors,
  dayKey,
  openSlots,
  saveAvailability,
  useAvailability,
  useDrives,
  type Availability,
} from "@/lib/drives";

export const Route = createFileRoute("/seller/test-drives/availability")({
  head: () => ({ meta: [{ title: "Your availability · OwnerFi" }] }),
  component: AvailabilityPage,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TIMES = Array.from({ length: 33 }, (_, i) => {
  const m = 360 + i * 30;
  const h = Math.floor(m / 60);
  return {
    value: `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    label: new Date(2000, 0, 1, h, m % 60).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
});
const PLACES = ["Police station lot", "Busy public parking lot"];

function DayRow({
  day,
  ranges,
  error,
  onChange,
}: {
  day: number;
  ranges: { from: string; to: string }[];
  error?: string | undefined;
  onChange: (r: { from: string; to: string }[]) => void;
}) {
  const on = ranges.length > 0;
  const patch = (i: number, p: Partial<{ from: string; to: string }>) => onChange(ranges.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <div className="border-t border-ink/10 py-4 first:border-t-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="w-40 shrink-0">
          <Checkbox label={DAYS[day]!} checked={on} onChange={(e) => onChange(e.target.checked ? [{ from: "17:00", to: "19:00" }] : [])} />
        </div>
        <div className="flex-1 space-y-2">
          {!on && <p className="py-2 text-muted">Not available</p>}
          {ranges.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1">
                <NativeSelect aria-label={`${DAYS[day]} start time`} value={r.from} options={TIMES} onChange={(e) => patch(i, { from: e.target.value })} />
              </div>
              <span className="text-muted">to</span>
              <div className="flex-1">
                <NativeSelect aria-label={`${DAYS[day]} end time`} value={r.to} options={TIMES} onChange={(e) => patch(i, { to: e.target.value })} />
              </div>
              <Button variant="ghost" size="sm" aria-label={`Remove time on ${DAYS[day]}`} onClick={() => onChange(ranges.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {on && ranges.length < 2 && (
            <Button variant="ghost" size="sm" leftIcon={<Plus aria-hidden className="h-4 w-4" />} onClick={() => onChange([...ranges, { from: "12:00", to: "13:00" }])}>
              Add another time
            </Button>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AvailabilityPage() {
  const saved = useAvailability();
  const drives = useDrives();
  const toast = useToast();
  const [form, setForm] = useState<Availability>(saved);
  const errs = availabilityErrors(form.weekly);
  const changed = JSON.stringify(form) !== JSON.stringify(saved);
  const valid = Object.keys(errs).length === 0 && form.place.trim().length > 0;
  const next = useMemo(
    () => (valid ? openSlots(form, drives, new Date(), new Date(Date.now() + 30 * 86_400_000)).slice(0, 6) : []),
    [form, drives, valid],
  );
  const setDay = (day: number, ranges: { from: string; to: string }[]) =>
    setForm({ ...form, weekly: [...form.weekly.filter((w) => w.day !== day), { day, ranges }] });

  return (
    <div className="mx-auto max-w-3xl pb-4">
      <Link to="/seller/test-drives" search={{}} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Test drives
      </Link>
      <PageHeader title="Your availability" description="Buyers can only book the times you open here." />
      <div className="space-y-5">
        <Card className="p-5">
          <CardHeader title="Weekly hours" description="Turn a day on and choose when you can meet." />
          {ORDER.map((d) => (
            <DayRow key={d} day={d} ranges={form.weekly.find((w) => w.day === d)?.ranges ?? []} error={errs[d]} onChange={(r) => setDay(d, r)} />
          ))}
        </Card>
        <Card className="space-y-4 p-5">
          <CardHeader title="Visit length" />
          <div>
            <p className="mb-2 text-sm font-medium">How long is a visit?</p>
            <Segmented
              label="How long is a visit?"
              value={String(form.slotMin)}
              options={[
                { value: "30", label: "30 min" },
                { value: "60", label: "60 min" },
              ]}
              onChange={(v) => setForm({ ...form, slotMin: Number(v) })}
            />
          </div>
          <NativeSelect
            label="Gap between visits"
            value={String(form.bufferMin)}
            options={[0, 15, 30].map((m) => ({ value: String(m), label: m === 0 ? "No gap" : `${m} minutes` }))}
            onChange={(e) => setForm({ ...form, bufferMin: Number(e.target.value) })}
          />
        </Card>
        <Card className="space-y-3 p-5">
          <CardHeader title="Meeting place" />
          <TextArea
            label="Where should buyers meet you?"
            helper="Buyers see this only after you accept."
            rows={2}
            maxLength={140}
            value={form.place}
            error={form.place.trim() ? undefined : "Add a meeting place."}
            onChange={(e) => setForm({ ...form, place: e.target.value })}
          />
          <div className="flex flex-wrap gap-2">
            {PLACES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForm({ ...form, place: p })}
                className="rounded-full border border-ink/15 px-3 py-1.5 text-sm font-medium hover:bg-ink/5"
              >
                {p}
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <CardHeader title="Days off" description="Pick days when you can’t meet anyone." />
          <div className="space-y-3">
            <Calendar
              value={null}
              minDate={new Date()}
              availableDates={form.blackout.map((b) => new Date(`${b}T00:00:00`))}
              onChange={(d) => {
                const k = dayKey(d);
                setForm({ ...form, blackout: form.blackout.includes(k) ? form.blackout.filter((x) => x !== k) : [...form.blackout, k].sort() });
              }}
            />
            {form.blackout.length === 0 ? (
              <p className="text-sm text-muted">No days off. Click a day to block it.</p>
            ) : (
              <ul aria-label="Days off" className="flex flex-wrap gap-2">
                {form.blackout.map((b) => (
                  <li key={b}>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, blackout: form.blackout.filter((x) => x !== b) })}
                      aria-label={`Remove ${format(new Date(`${b}T00:00:00`), "MMMM d")}`}
                      className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm font-medium"
                    >
                      {format(new Date(`${b}T00:00:00`), "EEE, MMM d")}
                      <X aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <CardHeader title="What buyers will see" />
          {next.length === 0 ? (
            <p className="text-muted">No open times yet. Turn on at least one day.</p>
          ) : (
            <p className="num text-muted">Next open times: {next.map((s) => format(s, "EEE, MMM d · h:mm a")).join(" · ")}</p>
          )}
        </Card>
      </div>
      <div className="sticky bottom-20 z-30 -mx-4 mt-6 border-t border-ink/10 bg-white p-3 md:bottom-0 md:mx-0 md:rounded-2xl md:border">
        <div className="mx-auto flex max-w-3xl justify-end gap-2">
          <Button variant="secondary" onClick={() => setForm(saved)} disabled={!changed}>
            Undo changes
          </Button>
          <Button
            disabled={!changed || !valid}
            onClick={() => {
              saveAvailability(form);
              toast({ tone: "success", title: "Availability saved" });
            }}
          >
            Save availability
          </Button>
        </div>
      </div>
    </div>
  );
}
