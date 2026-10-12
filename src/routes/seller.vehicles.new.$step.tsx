import { DEMO_MS, demoMs } from "@/lib/demo-latency";
import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CheckCircle2, Circle, Loader2, Sparkles, UploadCloud, XCircle } from "lucide-react";
import {
  Alert,
  AppLink,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Chip,
  NativeSelect,
  Skeleton,
  Slider,
  TextArea,
  TextInput,
  Breakdown,
  Popover,
  useToast,
} from "@/components/kit";
import { Stepper } from "@/components/kit-extra";
import { CarImage } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { useDemoStore } from "@/lib/demo-store";
import {
  DEMO_VINS,
  PHOTO_TAGS,
  PHOTO_TAG_LABEL,
  STEPS,
  STEP_LABEL,
  checksForVin,
  cleanVin,
  createDraft,
  decodeVin,
  isStep,
  patchDraft,
  publishGate,
  restartVin,
  saleMeter,
  stepIndex,
  useDrafts,
  vinOk,
  vinProblem,
  type Draft,
  type PhotoTag,
  type Step,
} from "@/lib/drafts";
import { DEFAULT_STATE_RULES, dealTerms, downPaymentAmount, marketPosition, rateCapForState } from "@/lib/finance";
import { money, moneyC, percent } from "@/lib/format";
import { fileToDataUrl } from "@/lib/images";
import { useSellerDeals } from "@/lib/seller-data";
import { useCurrentUser, type SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/vehicles/new/$step")({
  validateSearch: (s: Record<string, unknown>): { draft?: string; limit?: "1" } => ({
    ...(typeof s["draft"] === "string" ? { draft: s["draft"] } : {}),
    ...(s["limit"] === "1" ? { limit: "1" as const } : {}),
  }),
  head: () => ({ meta: [{ title: "Add a car · OwnerFi" }] }),
  component: WizardPage,
});

const WIZARD_STEPS = STEPS.filter((s) => s !== "done");

function useGo() {
  const navigate = useNavigate();
  return (step: Step, draftId?: string) =>
    navigate({
      to: "/seller/vehicles/new/$step",
      params: { step },
      search: (draftId ? { draft: draftId } : {}) as never,
    });
}

/* ------------------------------------------------------------- shared frame */

function Frame({
  step,
  title,
  description,
  draft,
  canContinue = true,
  reason,
  continueLabel = "Continue",
  busy,
  hideContinue,
  wide,
  onContinue,
  children,
}: {
  step: Step;
  title: string;
  description?: string;
  draft?: Draft | undefined;
  canContinue?: boolean;
  reason?: string | undefined;
  continueLabel?: string;
  busy?: boolean | undefined;
  hideContinue?: boolean | undefined;
  wide?: boolean;
  onContinue?: () => void;
  children: ReactNode;
}) {
  const go = useGo();
  const cur = stepIndex(step);
  const steps = WIZARD_STEPS.map((s, i) => ({
    id: s,
    label: STEP_LABEL[s],
    state: (i < cur ? "done" : i === cur ? "current" : "upcoming") as "done" | "current" | "upcoming",
  }));
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  return (
    <div className={cn("mx-auto pb-24 md:pb-0", wide ? "max-w-[960px]" : "max-w-[720px]")}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">New listing</p>
          <h1 className="mt-1 text-[28px] font-bold leading-9">Add a car</h1>
        </div>
        <div className="text-right">
          <AppLink to="/seller/vehicles" className="text-sm font-semibold text-primary hover:underline">
            Save and exit
          </AppLink>
          <p className="h-5 text-xs text-muted" aria-live="polite">
            {busy ? "Saving…" : draft ? "Saved" : ""}
          </p>
        </div>
      </div>
      <Card className="mb-5 px-5 py-4 md:px-6 md:py-5">
        <Stepper steps={steps} />
      </Card>
      <Card padding="none">
        <div className="p-5 md:p-7">
          <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">
            {title}
          </h2>
          {description && <p className="mt-1 text-muted">{description}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {!hideContinue && (
          <div className="fixed inset-x-0 bottom-14 z-20 border-t border-ink/10 bg-white p-3 md:static md:rounded-b-2xl md:bg-surface/60 md:px-7 md:py-4 lg:bottom-0">
            {!canContinue && reason && <p className="mb-2 text-sm text-muted md:text-right">{reason}</p>}
            <div className="flex gap-3 md:justify-between">
              <Button
                variant="secondary"
                className="flex-1 md:flex-none"
                onClick={() => {
                  const prev = STEPS[Math.max(stepIndex(step) - 1, 0)]!;
                  if (step === "vin") window.location.assign("/seller/vehicles");
                  else go(prev, draft?.id);
                }}
              >
                Back
              </Button>
              <Button className="flex-1 md:flex-none" disabled={!canContinue} loading={busy} onClick={onContinue}>
                {continueLabel}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

const Loading = () => (
  <div aria-busy="true" className="mx-auto max-w-[640px] space-y-4">
    <Skeleton className="h-10 w-1/2" />
    <Skeleton className="h-64" />
  </div>
);

/* --------------------------------------------------------------- VIN step */

function VinStep({ draft, user }: { draft?: Draft | undefined; user: SessionUser }) {
  const go = useGo();
  const toast = useToast();
  const gate = publishGate(user);
  const [vin, setVin] = useState(draft?.vin ?? "");
  const [car, setCar] = useState(draft && vinOk(draft.vin) ? draft.decoded : null);
  const [busy, setBusy] = useState(false);
  const problem = vinProblem(vin);
  const ok = vinOk(vin);
  const state = DEFAULT_STATE_RULES.find((r) => r.state === user.state) ?? DEFAULT_STATE_RULES[5]!;
  const typical = Math.max(5, state.max_apr - 2);

  const change = (v: string) => {
    setVin(cleanVin(v));
    setCar(null);
  };

  const lookup = () => {
    setBusy(true);
    window.setTimeout(() => {
      setCar(decodeVin(vin));
      setBusy(false);
    }, demoMs(DEMO_MS.vinLookup));
  };

  const next = () => {
    if (!car) return;
    if (draft) restartVin(draft.id, vin);
    const d = draft ?? createDraft(user.id, vin);
    go("title", d.id);
  };

  return (
    <Frame
      step="vin"
      title="What’s your car’s VIN?"
      description="The VIN is a 17-character code. We use it to fill in your car’s details."
      draft={draft}
      canContinue={!!car}
      reason="Look up your VIN to continue."
      onContinue={next}
    >
      <div className="space-y-4">
        {!gate.canPublish && (
          <Alert tone="info">
            You can start now. You’ll need to {gate.message.replace("You need to ", "").replace(" to publish.", "")} before you can
            publish.{" "}
            <AppLink to={gate.ctaTo} className="font-medium text-primary hover:underline">
              Finish setup
            </AppLink>
          </Alert>
        )}
        <TextInput
          label="VIN"
          value={vin}
          onChange={(e) => change(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={20}
          className="num font-mono tracking-wider"
          error={problem || undefined}
          helper="17 letters and numbers."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => toast({ tone: "info", title: "Camera isn’t available in the demo. Type the VIN instead." })}>
            Scan VIN
          </Button>
          <Popover
            trigger={({ toggle, props }) => (
              <Button variant="ghost" size="sm" onClick={toggle} {...props}>
                Where do I find my VIN?
              </Button>
            )}
            className="w-72 p-3"
          >
            {() => (
              <p className="text-sm">
                Look at the bottom corner of the windshield on the driver’s side, the sticker inside the driver’s door, or your title.
              </p>
            )}
          </Popover>
          <Popover
            trigger={({ toggle, props }) => (
              <Button variant="ghost" size="sm" onClick={toggle} {...props}>
                Demo VINs
              </Button>
            )}
            className="w-80 p-3"
          >
            {({ close }) => (
              <>
                <p className="mb-2 text-sm text-muted">VINs ending 0000, 9999 and 5555 trigger the special cases. Anything else passes.</p>
                <ul className="space-y-2">
                  {DEMO_VINS.map((d) => (
                    <li key={d.vin} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="block text-sm font-medium">{d.label}</span>
                        <span className="num block font-mono text-xs text-muted">{d.vin}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Use ${d.label} VIN`}
                        onClick={() => {
                          change(d.vin);
                          close();
                          toast({ tone: "info", title: "VIN filled in" });
                        }}
                      >
                        Use
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Popover>
        </div>
        <p className="text-xs text-muted">Demo: VINs ending 0000, 9999 or 5555 trigger special cases.</p>
        {!car && (
          <Button variant="secondary" disabled={!ok} loading={busy} onClick={lookup}>
            Look up
          </Button>
        )}
        {busy && <Skeleton className="h-48" />}
        {car && !busy && (
          <Card className="space-y-3" role="status">
            <h3 className="font-sans text-lg font-semibold tracking-normal">
              {car.year} {car.make} {car.model} {car.trim}
            </h3>
            <dl className="divide-y divide-ink/10">
              {[
                ["Body", car.body[0]!.toUpperCase() + car.body.slice(1)],
                ["Engine", car.engine],
                ["New price (MSRP)", money(car.msrp)],
                ["Market value today", `${money(car.marketValue.low)} – ${money(car.marketValue.high)}`],
                ["Typical rate for sellers like you", `${typical}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <Alert tone="info">Not your car? Change the VIN above.</Alert>
          </Card>
        )}
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------- title step */

function TitleStep({ draft, user }: { draft: Draft; user: SessionUser }) {
  const go = useGo();
  const [file, setFile] = useState<string | undefined>(draft.titleFileName);
  const [sole, setSole] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const mismatch = (file ?? "").toLowerCase().includes("mismatch");
  return (
    <Frame
      step="title"
      title="Add a photo of your title"
      description="The title proves the car is yours. Make sure all four corners show and your name is easy to read."
      draft={draft}
      canContinue={!!file && sole}
      reason={file ? "Tick the box to continue." : "Add a photo of your title to continue."}
      onContinue={() => {
        patchDraft(draft.id, { titleFileName: file }, "checks");
        go("checks", draft.id);
      }}
    >
      <div className="space-y-4">
        {file && draft.titleFileName === file && <Alert tone="success">Title photo saved: {file}. You can replace it.</Alert>}
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) setFile(f.name);
          }}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ink/20 bg-white px-4 py-8 text-center transition-colors hover:bg-ink/5"
        >
          <UploadCloud aria-hidden className="h-7 w-7 text-primary" />
          <span className="font-semibold">Photo of the front of your title</span>
          <span className="text-sm text-muted">JPG, PNG or PDF, up to 10 MB</span>
        </button>
        <input
          ref={input}
          type="file"
          hidden
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 10e6) setErr(`${f.name} is larger than 10 MB.`);
            else {
              setErr("");
              setFile(f.name);
            }
            e.target.value = "";
          }}
        />
        <p className="text-xs text-muted">Demo: name a file “mismatch” to see the name-match warning.</p>
        {err && (
          <p role="alert" className="text-sm text-danger">
            {err}
          </p>
        )}
        <Checkbox checked={sole} onChange={(e) => setSole(e.target.checked)} label="I’m the only person on the title." />
        {mismatch ? (
          <Alert tone="warning" title="The name might not match">
            The name on your title should match your account: {user.name}. We may ask for more proof.
          </Alert>
        ) : (
          <Alert tone="info">
            The name on the title should match the name on your account: {user.name}. If it doesn’t, we’ll ask for more proof.
          </Alert>
        )}
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------ checks step */

const CHECK_ROWS: [keyof Draft["checks"], string][] = [
  ["lien", "Lien-free title"],
  ["theft", "Stolen-vehicle check"],
  ["brand", "Salvage or branded title"],
  ["history", "Odometer and history report"],
];

function ChecksStep({ draft }: { draft: Draft }) {
  const go = useGo();
  const done0 = CHECK_ROWS.every(([k]) => draft.checks[k] !== "pending");
  const [shown, setShown] = useState(done0 ? CHECK_ROWS.length : 0);
  const started = useRef(false);

  const run = () => {
    setShown(0);
    const result = checksForVin(draft.vin);
    patchDraft(draft.id, { checks: result });
    let i = 0;
    const tick = () => {
      i += 1;
      setShown(i);
      if (i < CHECK_ROWS.length) window.setTimeout(tick, demoMs(DEMO_MS.checkRow));
    };
    window.setTimeout(tick, demoMs(DEMO_MS.checkRow));
  };

  useEffect(() => {
    if (!done0 && !started.current) {
      started.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finished = shown >= CHECK_ROWS.length;
  const c = draft.checks;
  const lien = c.lien === "fail";
  const theft = c.theft === "fail";
  const branded = c.brand === "review" || c.history === "review";
  const blocked = finished && (lien || theft);
  const stateOf = (i: number, k: keyof Draft["checks"]) => (i < shown ? c[k] : i === shown ? "running" : "pending");

  return (
    <Frame
      step="checks"
      title="Checking your car"
      description="We look for loans, theft reports and title problems. This takes a few seconds."
      draft={draft}
      hideContinue={!finished || blocked}
      onContinue={() => {
        patchDraft(draft.id, {}, "details");
        go("details", draft.id);
      }}
    >
      <div aria-live="polite" className="space-y-4">
        {!blocked && (
          <Card>
            <ul aria-label="Checks" className="divide-y divide-ink/10">
              {CHECK_ROWS.map(([k, label], i) => {
                const s = stateOf(i, k);
                return (
                  <li key={k} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex items-center gap-2">
                      {s === "running" && <Loader2 aria-hidden className="h-5 w-5 animate-spin text-primary" />}
                      {label}
                    </span>
                    <StatusChip kind="check" value={s} />
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
        {blocked && (
          <Card role="status" className="space-y-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
              <XCircle aria-hidden className="h-6 w-6" />
            </span>
            <h3 className="font-sans text-xl font-semibold tracking-normal">
              {lien ? "There’s still a loan on this car" : "We need to take a closer look"}
            </h3>
            <p className="text-muted">
              {lien
                ? "A bank or lender still has a claim on the title. We can’t list a car with a lien. Pay off the loan, then check again."
                : "Something about this VIN needs a closer look. Our team will review it within 24 hours and email you. You don’t need to do anything."}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {lien ? (
                <Button onClick={run}>Check again</Button>
              ) : (
                <ButtonLink to="/seller/vehicles">Back to my cars</ButtonLink>
              )}
              <Button variant="secondary" onClick={() => go("vin", draft.id)}>
                Use a different VIN
              </Button>
            </div>
            {lien && <p className="text-sm text-muted">Need help? Email support@ownerfi.example.</p>}
          </Card>
        )}
        {finished && !blocked && branded && (
          <Alert tone="warning" title="This car has a branded title">
            Branded means things like salvage or rebuilt. You can still list it. Buyers will see a clear notice, and our team reviews the
            listing before it goes live.
          </Alert>
        )}
        {finished && !blocked && !branded && (
          <div role="status" className="flex items-center gap-3 rounded-2xl bg-success/10 p-4">
            <CheckCircle2 aria-hidden className="h-6 w-6 text-success" />
            <div>
              <p className="font-semibold">Your car is clear</p>
              <p className="text-sm text-muted">Next: tell us about the car.</p>
            </div>
          </div>
        )}
      </div>
    </Frame>
  );
}

/* ----------------------------------------------------------- details step */

const COLORS = ["Black", "White", "Silver", "Gray", "Blue", "Red", "Green", "Brown", "Beige", "Other"].map((c) => ({ value: c, label: c }));
const FEATURES = [
  "Bluetooth",
  "Backup camera",
  "Heated seats",
  "Leather seats",
  "Sunroof",
  "Navigation",
  "Apple CarPlay / Android Auto",
  "Third row",
  "Tow package",
  "Remote start",
  "Keyless entry",
  "Adaptive cruise control",
  "Alloy wheels",
  "One owner",
];
const CONDITIONS = {
  excellent: { label: "Excellent", text: "Looks and drives like new. No known problems." },
  good: { label: "Good", text: "Normal wear for its age. Everything works." },
  fair: { label: "Fair", text: "Some cosmetic wear or small repairs needed." },
} as const;

function suggestDescription(d: Draft, mileage: number, condition: Draft["condition"], features: string[]) {
  const miles = mileage ? `${mileage.toLocaleString("en-US")} miles` : "low miles";
  const f = features.slice(0, 4).join(", ").toLowerCase();
  return [
    `${d.decoded.year} ${d.decoded.make} ${d.decoded.model} ${d.decoded.trim} in ${condition} condition with ${miles}.`,
    f ? `Comes with ${f}.` : "",
    "Clean title, checked by OwnerFi. Happy to answer questions and set up a test drive.",
  ]
    .filter(Boolean)
    .join(" ");
}

function DetailsStep({ draft, user }: { draft: Draft; user: SessionUser }) {
  const go = useGo();
  const [mileage, setMileage] = useState(draft.mileage ? String(draft.mileage) : "");
  const [ext, setExt] = useState(draft.exteriorColor);
  const [int, setInt] = useState(draft.interiorColor);
  const [condition, setCondition] = useState(draft.condition);
  const [features, setFeatures] = useState(draft.features);
  const [desc, setDesc] = useState(draft.description);
  const [city, setCity] = useState(draft.city);
  const [zip, setZip] = useState(draft.zip);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [writing, setWriting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const m = Number(mileage);
  const errs = {
    mileage: !mileage || m < 1 || m > 400000 ? "Enter the miles on the odometer (up to 400,000)." : "",
    desc: desc.trim().length < 20 ? "Write at least 20 characters." : "",
    city: city.trim() ? "" : "Enter the city where the car is.",
    zip: /^\d{5}$/.test(zip) ? "" : "Enter a 5-digit ZIP code.",
  };
  const ok = !errs.mileage && !errs.desc && !errs.city && !errs.zip && !!ext && !!int;
  const t = (k: keyof typeof errs) => (touched[k] ? errs[k] : "");
  const touch = (k: string) => setTouched((x) => ({ ...x, [k]: true }));
  const suggest = () => {
    setConfirm(false);
    setWriting(true);
    window.setTimeout(() => {
      setDesc(suggestDescription(draft, m, condition, features));
      setWriting(false);
    }, demoMs(DEMO_MS.writeDescription));
  };
  return (
    <Frame
      step="details"
      title="Tell buyers about your car"
      description="Honest details help the right buyer find you."
      draft={draft}
      canContinue={ok}
      reason="Fill in the details above to continue."
      onContinue={() => {
        patchDraft(
          draft.id,
          { mileage: m, exteriorColor: ext, interiorColor: int, condition, features, description: desc.trim(), city: city.trim(), zip },
          "photos",
        );
        go("photos", draft.id);
      }}
    >
      <div className="space-y-5">
        <TextInput
          label="Mileage"
          required
          type="number"
          inputMode="numeric"
          rightAdornment="miles"
          value={mileage}
          onChange={(e) => setMileage(e.target.value)}
          onBlur={() => touch("mileage")}
          error={t("mileage")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <NativeSelect label="Exterior color" required value={ext} onChange={(e) => setExt(e.target.value)} options={[{ value: "", label: "Choose" }, ...COLORS]} />
          <NativeSelect label="Interior color" required value={int} onChange={(e) => setInt(e.target.value)} options={[{ value: "", label: "Choose" }, ...COLORS]} />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Condition</legend>
          <div role="radiogroup" aria-label="Condition" className="grid gap-2">
            {(Object.keys(CONDITIONS) as (keyof typeof CONDITIONS)[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={condition === k}
                onClick={() => setCondition(k)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  condition === k ? "border-primary bg-primary/10" : "border-ink/15 hover:border-ink/30",
                )}
              >
                <span className="block font-semibold">{CONDITIONS[k].label}</span>
                <span className="block text-sm text-muted">{CONDITIONS[k].text}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Features</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Checkbox
                key={f}
                label={f}
                checked={features.includes(f)}
                onChange={(e) => setFeatures(e.target.checked ? [...features, f] : features.filter((x) => x !== f))}
              />
            ))}
          </div>
        </fieldset>
        <div>
          <TextArea
            label="Description"
            required
            rows={5}
            maxLength={1000}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => touch("desc")}
            error={t("desc")}
            helper={`${desc.length} / 1000`}
          />
          <div className="mt-2">
            {confirm ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Replace my text?</span>
                <Button size="sm" onClick={suggest}>
                  Replace
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  Keep mine
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={writing}
                leftIcon={writing ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden className="h-4 w-4" />}
                onClick={() => (desc.trim() ? setConfirm(true) : suggest())}
              >
                {writing ? "Writing…" : "Suggest a description"}
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Pickup city" required value={city} onChange={(e) => setCity(e.target.value)} onBlur={() => touch("city")} error={t("city")} />
          <TextInput
            label="ZIP code"
            required
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
            onBlur={() => touch("zip")}
            error={t("zip")}
          />
        </div>
        <p className="text-sm text-muted">Pickup in {DEFAULT_STATE_RULES.find((r) => r.state === user.state)?.state ?? user.state}.</p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------ photos step */

function PhotosStep({ draft }: { draft: Draft }) {
  const go = useGo();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>(draft.photos);
  const [tags, setTags] = useState<Record<string, PhotoTag>>(draft.photoTags);
  const [over, setOver] = useState(false);
  const tagged = photos.map((p) => tags[p]).filter((t): t is PhotoTag => !!t);
  const missing = PHOTO_TAGS.filter((t) => !tagged.includes(t));
  const need = Math.max(0, 6 - photos.length);
  const ok = need === 0 && missing.length === 0;
  const reason = need ? `Add ${need} more photo${need > 1 ? "s" : ""}.` : missing.length ? `Tag the ${PHOTO_TAG_LABEL[missing[0]!].toLowerCase()} shot.` : "";

  const add = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, Math.max(0, 20 - photos.length));
    const next: string[] = [];
    for (const f of list) {
      if (f.size > 10e6) {
        toast({ tone: "danger", title: `${f.name} is larger than 10 MB.` });
        continue;
      }
      try {
        next.push(await fileToDataUrl(f));
      } catch (e) {
        toast({ tone: "danger", title: e instanceof Error ? e.message : "We couldn’t add that photo." });
      }
    }
    if (next.length) setPhotos((p) => [...p, ...next]);
  };

  const tag = (url: string, t: PhotoTag | "") =>
    setTags((cur) => {
      const out = { ...cur };
      for (const k of Object.keys(out)) if (t && out[k] === t) delete out[k];
      if (t) out[url] = t;
      else delete out[url];
      return out;
    });

  return (
    <Frame
      step="photos"
      title="Add photos"
      description="Good photos sell cars. Add at least 6, including the shots below."
      draft={draft}
      canContinue={ok}
      reason={reason}
      onContinue={() => {
        patchDraft(draft.id, { photos, photoTags: tags }, "terms");
        go("terms", draft.id);
      }}
    >
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (e.dataTransfer.files.length) void add(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            over ? "border-primary bg-primary/10" : "border-ink/20 bg-white hover:bg-ink/5",
          )}
        >
          <UploadCloud aria-hidden className="h-7 w-7 text-primary" />
          <span className="font-semibold">Add photos of your car</span>
          <span className="text-sm text-muted">JPG or PNG, up to 10 MB each. The first photo is the cover.</span>
        </button>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept="image/*"
          onChange={(e) => {
            if (e.target.files) void add(e.target.files);
            e.target.value = "";
          }}
        />
        <Card>
          <h3 className="mb-3 font-sans font-semibold tracking-normal">Required photos</h3>
          <ul aria-label="Required photos" className="grid grid-cols-2 gap-2 text-sm">
            {PHOTO_TAGS.map((t) => {
              const has = tagged.includes(t);
              return (
                <li key={t} className="flex items-center gap-2">
                  {has ? <Check aria-hidden className="h-4 w-4 text-success" /> : <Circle aria-hidden className="h-4 w-4 text-muted" />}
                  <span className={has ? "text-ink" : "text-muted"}>
                    {PHOTO_TAG_LABEL[t]}
                    <span className="sr-only">{has ? " added" : " still needed"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
        {photos.length > 0 && (
          <ul className="space-y-3">
            {photos.map((p, i) => (
              <li key={p.slice(-40) + i} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white p-2.5">
                <img src={p} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <NativeSelect
                    size="sm"
                    aria-label={`What is photo ${i + 1} of?`}
                    value={tags[p] ?? ""}
                    onChange={(e) => tag(p, e.target.value as PhotoTag | "")}
                    options={[{ value: "", label: "What’s this a photo of?" }, ...PHOTO_TAGS.map((t) => ({ value: t, label: PHOTO_TAG_LABEL[t] }))]}
                  />
                </div>
                {i === 0 ? (
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">Cover</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPhotos((cur) => [p, ...cur.filter((x) => x !== p)])}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Make cover
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setPhotos((cur) => cur.filter((x) => x !== p))}
                  className="rounded-lg p-2 text-muted hover:bg-ink/5"
                >
                  <XCircle aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">Shoot in daylight. Clean the car first. Show any scratches. Honest photos sell faster.</p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------- terms step */

const MARKET_NOTE = {
  below: "Below market. Likely to sell fast.",
  fair: "In the fair range.",
  above: "Above market. It may take longer to sell.",
} as const;

function MarketBar({ price, range }: { price: number; range: { low: number; high: number } }) {
  const lo = range.low * 0.8;
  const hi = range.high * 1.2;
  const at = (x: number) => Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100));
  const pos = marketPosition(price, range);
  return (
    <div aria-live="polite">
      <div className="relative mt-2 h-2 rounded-full bg-ink/10">
        <div className="absolute inset-y-0 rounded-full bg-primary/30" style={{ left: `${at(range.low)}%`, width: `${at(range.high) - at(range.low)}%` }} />
        {price > 0 && (
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
            style={{ left: `${at(price)}%` }}
          />
        )}
      </div>
      <p className="mt-2 text-sm">
        {price > 0 && <span className="font-medium">{MARKET_NOTE[pos]} </span>}
        <span className="text-muted">
          Cars like yours sell for {money(range.low)}–{money(range.high)}.
        </span>
      </p>
    </div>
  );
}

function Earnings({ price, minDownPct, apr, termMonths, id }: { price: number; minDownPct: number; apr: number; termMonths: number; id?: string }) {
  const down = price > 0 ? downPaymentAmount(price * 100, minDownPct) : 0;
  const t = dealTerms({ priceCents: Math.max(price, 1) * 100, downPct: minDownPct, apr, termMonths });
  return (
    <Card id={id} className="lg:sticky lg:top-24">
      <h3 className="font-sans text-lg font-semibold tracking-normal">What you’ll earn</h3>
      <Breakdown
        className="mt-2"
        rows={[
          { label: "Sale price", value: money(price) },
          { label: `Down payment (${minDownPct}%)`, value: moneyC(down) },
          {
            label: "OwnerFi fee",
            value: `−${moneyC(t.fee)}`,
            tone: "negative",
            hint: "10% of the down payment, taken when the buyer pays in the app. No fee on monthly payments.",
          },
          { label: "You receive at closing", value: moneyC(t.sellerNet) },
          { label: "Buyer finances", value: moneyC(t.financed) },
          { label: `Monthly payment (${termMonths} mo)`, value: moneyC(t.monthly), hint: "Goes straight to you. No OwnerFi fee." },
          { label: "Total interest", value: moneyC(t.interest) },
        ]}
        total={{ label: "Total proceeds", value: moneyC(t.sellerTotal) }}
      />
      <p className="mt-3 text-sm text-muted">Example at your minimum down payment. Buyers can offer more down.</p>
    </Card>
  );
}

function TermsStep({ draft, user }: { draft: Draft; user: SessionUser }) {
  const go = useGo();
  const cap = rateCapForState(user.state);
  const typical = Math.max(5, cap - 2);
  const range = { low: draft.decoded.marketValue.low, high: draft.decoded.marketValue.high };
  const [price, setPrice] = useState(String(draft.terms.askingPrice));
  const [down, setDown] = useState(Math.max(10, draft.terms.minDownPct));
  const [apr, setApr] = useState(Math.min(draft.terms.apr, cap));
  const [lens, setLens] = useState<number[]>(draft.terms.allowedTerms);
  const [show, setShow] = useState(lens.includes(48) ? 48 : (lens.at(-1) ?? 48));
  const p = Number(price);
  const okPrice = p >= 1000;
  const toggle = (m: number) => setLens((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m]).sort((a, b) => a - b));
  const shownTerm = lens.includes(show) ? show : (lens.at(-1) ?? 48);
  return (
    <Frame
      step="terms"
      wide
      title="Set your price and terms"
      description="You choose the price, the down payment and the rate. You can change these later."
      draft={draft}
      canContinue={okPrice && lens.length > 0}
      reason={okPrice ? "Pick at least one loan length." : "Enter a price of at least $1,000."}
      onContinue={() => {
        patchDraft(draft.id, { terms: { askingPrice: p, minDownPct: down, apr: Math.min(apr, cap), allowedTerms: lens } }, "review");
        go("review", draft.id);
      }}
    >
      <a href="#earnings" className="mb-4 block rounded-xl bg-primary/10 p-3 text-sm md:hidden">
        <span className="font-medium">See what you’ll earn →</span>
      </a>
      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div>
            <TextInput
              label="Asking price"
              required
              inputMode="numeric"
              leftAdornment="$"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
              error={price && !okPrice ? "Enter a price of at least $1,000." : ""}
            />
            <MarketBar price={okPrice ? p : 0} range={range} />
          </div>
          <div>
            <p className="text-sm font-medium">Minimum down payment</p>
            <Slider label="Minimum down payment" min={10} max={30} value={down} onChange={setDown} formatValue={(x) => `${x}%`} className="px-8" />
            <p className="mt-1 text-sm text-muted">
              {money(okPrice ? Math.round((p * down) / 100) : 0)} down. The buyer pays at least this, in the app, before you hand over the car.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Interest rate (APR)</p>
            <Slider
              label="Interest rate (APR)"
              min={0}
              max={cap}
              step={0.5}
              value={apr}
              onChange={(x) => setApr(Math.min(x, cap))}
              formatValue={percent}
              marker={{ value: cap, label: `State max ${cap}%` }}
              className="px-8"
            />
            <p className="mt-1 text-sm text-muted">
              {apr >= cap ? `That’s the highest rate ${user.state} allows. ` : ""}Sellers like you typically charge about {typical}%.
            </p>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Loan lengths buyers can pick</legend>
            <div className="flex flex-wrap gap-2">
              {[24, 36, 48, 60].map((m) => (
                <Chip key={m} selected={lens.includes(m)} onClick={() => toggle(m)}>
                  {m} months
                </Chip>
              ))}
            </div>
          </fieldset>
          {lens.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Show earnings for</span>
              <div role="radiogroup" aria-label="Show earnings for" className="inline-flex rounded-xl bg-surface p-1">
                {lens.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={m === shownTerm}
                    onClick={() => setShow(m)}
                    className={cn("h-8 rounded-lg px-3 text-sm font-semibold", m === shownTerm ? "bg-white text-ink shadow-card" : "text-muted")}
                  >
                    {m} mo
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <Earnings id="earnings" price={okPrice ? p : 0} minDownPct={down} apr={Math.min(apr, cap)} termMonths={shownTerm} />
        </div>
      </div>
    </Frame>
  );
}

/* ----------------------------------------------------------- review step */

function EditCard({ title, step, draft, children }: { title: string; step: Step; draft: Draft; children: ReactNode }) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-sans font-semibold tracking-normal">{title}</h3>
        <Link
          to="/seller/vehicles/new/$step"
          params={{ step }}
          search={{ draft: draft.id }}
          className="text-sm font-medium text-primary hover:underline"
        >
          Edit<span className="sr-only"> {title.toLowerCase()}</span>
        </Link>
      </div>
      {children}
    </Card>
  );
}

function ReviewStep({ draft, user }: { draft: Draft; user: SessionUser }) {
  const go = useGo();
  const { addVehicle, updateVehicle } = useDemoStore();
  const deals = useSellerDeals();
  const gate = publishGate(user);
  const used = deals.filter((d) => d.stage === "active" || d.stage === "paid_off").length;
  const meter = saleMeter(user, used);
  const atLimit = meter.remaining === 0 || new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("limit") === "1";
  const review = draft.checks.brand === "review" || draft.checks.history === "review";
  const [boxes, setBoxes] = useState([false, false, false, false]);
  const [busy, setBusy] = useState(false);
  const all = (review ? boxes : boxes.slice(0, 3)).every(Boolean);
  const can = gate.canPublish && !atLimit && all;
  const tm = draft.terms;
  const term = tm.allowedTerms.includes(48) ? 48 : tm.allowedTerms.at(-1)!;
  const t = dealTerms({ priceCents: tm.askingPrice * 100, downPct: tm.minDownPct, apr: tm.apr, termMonths: term });
  const set = (i: number, v: boolean) => setBoxes((b) => b.map((x, j) => (j === i ? v : x)));

  const publish = () => {
    setBusy(true);
    const v = addVehicle({
      vin: draft.vin,
      year: draft.decoded.year,
      make: draft.decoded.make,
      model: draft.decoded.model,
      trim: draft.decoded.trim,
      body: draft.decoded.body,
      mileage: draft.mileage,
      exterior_color: draft.exteriorColor,
      interior_color: draft.interiorColor,
      condition: draft.condition,
      description: draft.description,
      city: draft.city,
      state: user.state,
      price_cents: tm.askingPrice * 100,
      min_down_pct: tm.minDownPct,
      apr: tm.apr,
      allowed_terms: tm.allowedTerms,
      market_low_cents: draft.decoded.marketValue.low * 100,
      market_high_cents: draft.decoded.marketValue.high * 100,
      photos: draft.photos,
      features: draft.features,
      history_summary: { owners: 1, accidents: 0, title: review ? "branded" : "clean" },
    });
    if (review) updateVehicle(v.id, { status: "pending_review" });
    patchDraft(draft.id, { published: { id: v.id, pendingReview: review } }, "done");
    go("done", draft.id);
  };

  return (
    <Frame
      step="review"
      title="Review and publish"
      description="Check everything. You can change your price and terms after you publish."
      draft={draft}
      canContinue={can}
      reason={gate.canPublish ? (atLimit ? "You’ve reached the yearly limit for your state." : "Tick every box to publish.") : gate.message}
      continueLabel={review ? "Submit for review" : "Publish my car"}
      busy={busy}
      onContinue={publish}
    >
      <div className="space-y-4">
        <EditCard title="Your car" step="details" draft={draft}>
          <p className="font-medium">
            {draft.decoded.year} {draft.decoded.make} {draft.decoded.model} {draft.decoded.trim}
          </p>
          <p className="text-sm text-muted">
            {draft.mileage.toLocaleString("en-US")} mi · {draft.exteriorColor} / {draft.interiorColor} · {CONDITIONS[draft.condition].label} ·{" "}
            {draft.city}, {user.state} {draft.zip}
          </p>
          <p className="mt-2 text-sm">{draft.description}</p>
        </EditCard>
        <EditCard title="Photos" step="photos" draft={draft}>
          <div className="flex gap-2 overflow-x-auto">
            {draft.photos.slice(0, 6).map((p, i) => (
              <div key={i} className="w-24 shrink-0">
                <CarImage src={p} alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`} aspect="4/3" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{draft.photos.length} photos. The first one is the cover.</p>
        </EditCard>
        <EditCard title="Price and terms" step="terms" draft={draft}>
          <Breakdown
            rows={[
              { label: "Asking price", value: money(tm.askingPrice) },
              { label: "Minimum down payment", value: `${moneyC(t.down)} (${tm.minDownPct}%)` },
              { label: "Interest rate", value: percent(tm.apr) },
              { label: "Loan lengths", value: `${tm.allowedTerms.join(", ")} months` },
              { label: "You receive at closing", value: moneyC(t.sellerNet), hint: `After the OwnerFi fee of ${moneyC(t.fee)} (10% of the down payment).` },
            ]}
            total={{ label: "Total proceeds", value: moneyC(t.sellerTotal) }}
          />
        </EditCard>
        <p className="text-sm text-muted">
          You’ve sold {meter.used} of {meter.limit} cars this year in {user.state}.
        </p>
        {atLimit && (
          <Alert tone="danger" title={`You’ve reached the limit for ${user.state}`}>
            Private sellers can finance up to {meter.limit} cars a year here. You can list again after your oldest sale is a year old.
          </Alert>
        )}
        {!gate.canPublish && (
          <Alert
            tone="warning"
            title="One more thing before you publish"
            action={
              <ButtonLink to={gate.ctaTo} size="sm">
                Finish setup
              </ButtonLink>
            }
          >
            {gate.message} Your draft is saved.
          </Alert>
        )}
        {review && (
          <Alert tone="warning" title="This car has a branded title">
            Buyers will see a notice. Our team reviews your listing before it goes live.
          </Alert>
        )}
        <fieldset className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
          <legend className="px-1 text-sm font-medium">Before you publish</legend>
          <Checkbox
            checked={boxes[0]!}
            onChange={(e) => set(0, e.target.checked)}
            label="I understand I’m financing this sale and I’ll stay on the title until it’s paid off."
          />
          <Checkbox
            checked={boxes[1]!}
            onChange={(e) => set(1, e.target.checked)}
            label="I understand OwnerFi charges 10% of the down payment, paid from my side at closing."
          />
          <Checkbox checked={boxes[2]!} onChange={(e) => set(2, e.target.checked)} label="The car, photos and details are accurate." />
          {review && (
            <Checkbox checked={boxes[3]!} onChange={(e) => set(3, e.target.checked)} label="I’ll tell buyers about the branded title." />
          )}
        </fieldset>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------- done step */

function DoneStep({ draft }: { draft: Draft }) {
  const pub = draft.published;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  if (!pub) return <Navigate to="/seller/vehicles/new/$step" params={{ step: "review" }} search={{ draft: draft.id }} replace />;
  const t = dealTerms({ priceCents: draft.terms.askingPrice * 100, downPct: draft.terms.minDownPct, apr: draft.terms.apr, termMonths: Math.max(...draft.terms.allowedTerms) });
  return (
    <div className="mx-auto max-w-[640px] space-y-5 pb-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 aria-hidden className="h-7 w-7" />
      </span>
      <h1 ref={heading} tabIndex={-1} className="text-[28px] font-bold leading-9">
        {pub.pendingReview ? "We’re reviewing your car" : "Your car is live"}
      </h1>
      <p className="text-muted">
        {pub.pendingReview ? "Our team will check it within 24 hours. We’ll email you when it’s live." : "Buyers can see it now."}
      </p>
      <Card className="text-left">
        <div className="flex gap-4">
          <div className="w-28 shrink-0">
            <CarImage src={draft.photos[0]} alt="" make={draft.decoded.make} model={draft.decoded.model} aspect="4/3" />
          </div>
          <div>
            <p className="font-semibold">
              {draft.decoded.year} {draft.decoded.make} {draft.decoded.model}
            </p>
            <p className="num">{money(draft.terms.askingPrice)}</p>
            <p className="text-sm text-muted">
              From {moneyC(t.down)} down, about {moneyC(t.monthly)}/mo
            </p>
          </div>
        </div>
      </Card>
      <Card className="text-left">
        <h2 className="mb-2 font-sans font-semibold tracking-normal">What happens next</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>Buyers see your car.</li>
          <li>You get a message when someone’s interested.</li>
          <li>You approve every buyer before anything is signed.</li>
        </ol>
      </Card>
      <div className="flex flex-col gap-3">
        <ButtonLink to={`/seller/vehicles/${pub.id}/advertise`}>Advertise everywhere</ButtonLink>
        {!pub.pendingReview && (
          <ButtonLink variant="secondary" to={`/cars/${pub.id}`}>
            View listing
          </ButtonLink>
        )}
        <ButtonLink variant="ghost" to="/seller/vehicles">
          Back to my cars
        </ButtonLink>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

/** The first step the draft still needs, so deep links can't skip ahead. */
function reachable(d: Draft): Step {
  const blocked = d.checks.lien === "fail" || d.checks.theft === "fail";
  if (blocked) return "checks";
  return d.reached;
}

function WizardPage() {
  const { step } = Route.useParams();
  const { draft: draftId } = Route.useSearch();
  const user = useCurrentUser();
  const drafts = useDrafts();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!isStep(step)) return <Navigate to="/seller/vehicles/new/$step" params={{ step: "vin" }} replace />;
  if (!user) return null;
  if (!ready) return <Loading />;

  const draft = draftId ? drafts[draftId] : undefined;
  if (step !== "vin" && !draft) return <Navigate to="/seller/vehicles/new/$step" params={{ step: "vin" }} replace />;
  if (draft && step !== "vin" && step !== "done" && stepIndex(step) > stepIndex(reachable(draft))) {
    return <Navigate to="/seller/vehicles/new/$step" params={{ step: reachable(draft) }} search={{ draft: draft.id }} replace />;
  }
  if (draft && step === "done" && !draft.published) {
    return <Navigate to="/seller/vehicles/new/$step" params={{ step: "review" }} search={{ draft: draft.id }} replace />;
  }

  if (step === "vin") return <VinStep key={draft?.id ?? "new"} draft={draft} user={user} />;
  if (!draft) return null;
  if (step === "title") return <TitleStep draft={draft} user={user} />;
  if (step === "checks") return <ChecksStep draft={draft} />;
  if (step === "details") return <DetailsStep draft={draft} user={user} />;
  if (step === "photos") return <PhotosStep draft={draft} />;
  if (step === "terms") return <TermsStep draft={draft} user={user} />;
  if (step === "review") return <ReviewStep draft={draft} user={user} />;
  return <DoneStep draft={draft} />;
}
