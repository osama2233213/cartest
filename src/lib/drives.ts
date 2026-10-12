import { useSyncExternalStore } from "react";

export type DriveStatus = "requested" | "confirmed" | "declined" | "rescheduled" | "completed" | "no_show" | "cancelled";

export type Drive = {
  id: string;
  sellerName: string;
  buyerName: string;
  car: string;
  vehicleId?: string | undefined;
  dealId?: string | undefined;
  start: string;
  durationMin: number;
  place: string;
  note?: string | undefined;
  /** Why the buyer cancelled. */
  cancelReason?: string | undefined;
  status: DriveStatus;
};

export type Availability = {
  weekly: { day: number; ranges: { from: string; to: string }[] }[];
  slotMin: number;
  bufferMin: number;
  place: string;
  blackout: string[];
};

export const OPEN: DriveStatus[] = ["requested", "confirmed", "rescheduled"];

const KEY = "ownerfi-poc-drives-v1";
const AV_KEY = "ownerfi-poc-availability-v1";

const at = (days: number, h: number, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

function seedDrives(): Drive[] {
  return [
    { id: "td-1", sellerName: "Maria Alvarez", buyerName: "Aisha Khan", car: "2019 Tesla Model 3", start: at(2, 14), durationMin: 30, place: "Police station lot, Camelback Rd", status: "requested", note: "Can I bring my mechanic?" },
    { id: "td-2", sellerName: "Maria Alvarez", buyerName: "Daniel Park", car: "2020 Honda Accord", start: at(4, 11), durationMin: 30, place: "Police station lot, Camelback Rd", status: "confirmed" },
    { id: "td-3", sellerName: "Maria Alvarez", buyerName: "Leo Chen", car: "2020 Honda Accord", start: at(-6, 16), durationMin: 30, place: "Police station lot, Camelback Rd", status: "completed" },
    { id: "td-4", sellerName: "James Torres", buyerName: "Daniel Park", car: "2018 Ford F-150", start: at(3, 10), durationMin: 30, place: "Busy public parking lot, Austin", status: "confirmed" },
  ];
}

function seedAvailability(): Availability {
  return {
    weekly: [1, 2, 3, 4, 5].map((day) => ({ day, ranges: [{ from: "17:00", to: "19:00" }] })).concat([{ day: 6, ranges: [{ from: "10:00", to: "14:00" }] }]),
    slotMin: 30,
    bufferMin: 15,
    place: "Police station lot, Camelback Rd",
    blackout: [],
  };
}

let drives: Drive[] = [];
let avail: Availability = seedAvailability();
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY: Drive[] = [];
const SERVER_AV = seedAvailability();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    drives = raw ? (JSON.parse(raw) as Drive[]) : seedDrives();
    const a = localStorage.getItem(AV_KEY);
    if (a) avail = JSON.parse(a) as Availability;
  } catch {
    drives = seedDrives();
  }
}

const emit = () => listeners.forEach((l) => l());
function writeDrives(next: Drive[]) {
  drives = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  emit();
}

const sub = (l: () => void) => {
  load();
  listeners.add(l);
  l();
  return () => listeners.delete(l);
};

export const useDrives = (): Drive[] => useSyncExternalStore(sub, () => drives, () => EMPTY);
export const useAvailability = (): Availability => useSyncExternalStore(sub, () => avail, () => SERVER_AV);

export function saveAvailability(next: Availability) {
  load();
  avail = next;
  try {
    localStorage.setItem(AV_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  emit();
}

export function requestDrive(d: Omit<Drive, "id" | "status">) {
  load();
  writeDrives([{ ...d, id: `td-${Date.now().toString(36)}`, status: "requested" }, ...drives]);
}

export function setDriveStatus(id: string, status: DriveStatus, patch: Partial<Drive> = {}) {
  load();
  writeDrives(drives.map((d) => (d.id === id ? { ...d, ...patch, status } : d)));
}

export function resetDrives() {
  load();
  writeDrives(seedDrives());
}

/* ------------------------------------------------------------ slot logic */

export const toMin = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Open start times between two dates, given the seller's hours and what is already booked. */
export function openSlots(a: Availability, booked: Drive[], from: Date, to: Date) {
  const out: Date[] = [];
  const taken = booked.filter((d) => OPEN.includes(d.status)).map((d) => new Date(d.start).getTime());
  for (let t = new Date(from.getFullYear(), from.getMonth(), from.getDate()); t <= to; t.setDate(t.getDate() + 1)) {
    if (a.blackout.includes(dayKey(t))) continue;
    const day = a.weekly.find((w) => w.day === t.getDay());
    for (const r of day?.ranges ?? []) {
      for (let m = toMin(r.from); m + a.slotMin <= toMin(r.to); m += a.slotMin + a.bufferMin) {
        const s = new Date(t.getFullYear(), t.getMonth(), t.getDate(), Math.floor(m / 60), m % 60);
        if (s > from && !taken.includes(s.getTime())) out.push(s);
      }
    }
  }
  return out;
}

export function availabilityErrors(weekly: Availability["weekly"]) {
  const errs: Record<number, string> = {};
  for (const w of weekly) {
    for (const r of w.ranges) {
      if (toMin(r.to) <= toMin(r.from)) errs[w.day] = "The end time has to be after the start.";
    }
    if (w.ranges.length === 2) {
      const [a, b] = [...w.ranges].sort((x, y) => toMin(x.from) - toMin(y.from));
      if (a && b && toMin(b.from) < toMin(a.to)) errs[w.day] = "These times overlap.";
    }
  }
  return errs;
}
