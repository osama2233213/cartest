import { useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronDown, FileText, PartyPopper, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  Alert,
  AppLink,
  Avatar,
  Breakdown,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Checkbox,
  Modal,
  NativeSelect,
  Segmented,
  Slider,
  TextArea,
  TextInput,
  useToast,
} from "@/components/kit";
import { Stepper } from "@/components/kit-extra";
import { PayModal } from "@/components/app/PayModal";
import { CarImage } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { STAGES, getNextAction, termsFor, type DemoDeal, type Role, type Stage } from "@/lib/demo-data";
import { RuleError, feeLabel, maxRounds, canCancel, canRenegotiate, canSubmitOffer, currentOffer, normalizePayment, roundsUsed } from "@/lib/deal-rules";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { offersOf, useDemoStore, type DealDetailData } from "@/lib/demo-store";
import { dealTerms, rateCapForState } from "@/lib/finance";
import { moneyC, percent, shortCar } from "@/lib/format";
import { notify } from "@/lib/notify";
import { sellerViewForBuyer } from "@/lib/risk-profile";
import { demoFlags, useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------- data */

const LABELS: Record<(typeof STAGES)[number], string> = {
  inquiry: "Questions",
  test_drive: "Test drive",
  application: "Offer",
  negotiation: "Negotiation",
  inspection: "Inspection",
  contract: "Contract",
  down_payment: "Down payment",
  closing: "Closing at the DMV",
  active: "Monthly payments",
  paid_off: "Paid off",
};

/* ------------------------------------------------------------------ modals */

function CounterModal({ d, role, onClose, renegotiate }: { d: DemoDeal; role: Role; onClose: () => void; renegotiate?: boolean }) {
  const { submitCounterOffer, decideInspection, getDealDetail } = useDemoStore();
  const toast = useToast();
  const cap = rateCapForState(d.state ?? "AZ");
  const minDown = d.minDownPct ?? 10;
  const terms = d.allowedTerms?.length ? d.allowedTerms : [24, 36, 48, 60];
  const detail = getDealDetail(d.id);
  const used = renegotiate ? 0 : roundsUsed(offersOf(detail), detail.roundBase ?? 0);
  const [price, setPrice] = useState(String(Math.round(d.priceCents / 100)));
  const [down, setDown] = useState(d.downPct);
  const [apr, setApr] = useState(Math.min(d.apr, cap));
  const [term, setTerm] = useState(d.term);
  const [note, setNote] = useState(renegotiate ? "" : "We can meet in the middle at these terms.");
  const p = Number(price);
  const calc = dealTerms({ priceCents: Math.max(0, p * 100), downPct: down, apr, termMonths: term });
  const error = !p ? "Enter a price." : down < minDown || down > 30 ? `Down payment must be between ${minDown}% and 30%.` : "";
  return (
    <Modal
      open
      onClose={onClose}
      title={renegotiate ? "Ask for new terms" : "Make a counter-offer"}
      description={renegotiate ? "You can do this once. The seller can accept, counter or decline." : `This is counter ${used + 1} of ${maxRounds()}. They can say yes, counter again or decline.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!!error}
            onClick={() => {
              const t = { priceCents: p * 100, downPct: down, apr, term };
              try {
                if (renegotiate) decideInspection(d.id, "renegotiate", { terms: t, ...(note.trim() ? { note: note.trim() } : {}) });
                else submitCounterOffer(d.id, t, role === "seller" ? "seller" : "buyer", note);
                toast({ tone: "success", title: renegotiate ? "New terms sent" : "Counter-offer sent" });
                onClose();
              } catch (e) {
                toast({ tone: "danger", title: e instanceof Error ? e.message : "That didn’t work." });
              }
            }}
          >
            {renegotiate ? "Send new terms" : "Send counter-offer"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextInput label="Price" inputMode="numeric" leftAdornment="$" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} error={!p ? "Enter a price." : undefined} />
        <div>
          <p className="text-sm font-medium">Down payment</p>
          <Slider label="Down payment" min={minDown} max={30} value={Math.max(minDown, down)} onChange={setDown} formatValue={(x) => `${x}%`} />
        </div>
        <div>
          <p className="text-sm font-medium">Interest rate</p>
          <Slider label="Interest rate" min={0} max={cap} step={0.5} value={apr} onChange={setApr} formatValue={percent} marker={{ value: cap, label: "State max" }} />
        </div>
        <Segmented label="Length" value={String(term)} onChange={(v) => setTerm(Number(v))} className="flex w-full" options={terms.map((m) => ({ value: String(m), label: `${m} mo` }))} />
        <TextArea label="Note" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        {!error && (
          <p className="num rounded-xl bg-surface p-3 text-sm">
            About <strong>{moneyC(calc.monthly)}/mo</strong> with {moneyC(calc.down)} down.
          </p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

function ReasonModal({
  title,
  description,
  confirm,
  reasons,
  danger,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirm: string;
  reasons?: string[];
  danger?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(reasons?.[0] ?? "");
  const [note, setNote] = useState("");
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Back
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => onConfirm([reason, note.trim()].filter(Boolean).join(": "))}>
            {confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {reasons && (
          <div role="radiogroup" aria-label="Reason" className="space-y-2">
            {reasons.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={cn("flex w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium", reason === r ? "border-primary bg-primary/10" : "border-ink/15 hover:border-ink/30")}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <TextArea label="Add a note (optional)" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------- stage content */

function Terms({ d, detail }: { d: DemoDeal; detail: DealDetailData }) {
  const t = termsFor(d);
  const rows = [
    ["Price", moneyC(d.priceCents)],
    ["Down payment", `${d.downPct}% (${moneyC(t.down)})`],
    ["Rate", `${d.apr}% APR`],
    ["Length", `${d.term} months`],
    ["Monthly", `${moneyC(t.monthly)}/mo`],
  ];
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow text-muted">{detail.counterOffer?.proposedBy === "seller" ? "Seller’s counter-offer" : "The offer"}</p>
        <span className="text-xs font-semibold text-primary">{(() => {
          const o = offersOf(detail);
          const c = currentOffer(o);
          return c ? `Version ${c.version}` : "First offer";
        })()}</span>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="num font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {detail.counterOffer?.note && <p className="mt-3 border-l-2 border-ink/15 pl-3 text-sm italic text-muted">“{detail.counterOffer.note}”</p>}
    </div>
  );
}

function RiskSummary({ buyer }: { buyer: string }) {
  // The same summary the buyer sees on "What sellers see": no raw credit, ID or SSN.
  const view = sellerViewForBuyer(buyer);
  const rows = view.rows.map((r) => [r.label, r.value]);
  const LEVEL = { low: ["Low risk", "bg-success/10 text-success"], medium: ["Medium risk", "bg-warning/15 text-warning"], high: ["Higher risk", "bg-danger/10 text-danger"] } as const;
  return (
    <div className="rounded-2xl border border-success/25 bg-success/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-semibold text-success">
          <ShieldCheck aria-hidden className="h-4 w-4" /> Buyer risk summary
        </p>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", LEVEL[view.level][1])}>{LEVEL[view.level][0]}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        {view.notes.map((x) => (
          <li key={x} className="flex items-center gap-2">
            <Check aria-hidden className="h-4 w-4 text-success" /> {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EarnPreview({ d }: { d: DemoDeal }) {
  const t = termsFor(d);
  return (
    <div>
      <h3 className="mb-1 font-sans font-semibold tracking-normal">If you agree to these terms</h3>
      <Breakdown
        rows={[
          { label: "Down payment", value: moneyC(t.down) },
          { label: "OwnerFi fee", hint: "10% of the down payment, taken from it when it’s paid.", value: `− ${moneyC(t.fee)}`, tone: "negative" },
          { label: "You receive at closing", value: moneyC(t.sellerNet) },
          { label: "Monthly payment", hint: `${d.term} months at ${percent(d.apr)}. Paid to you, no fee.`, value: moneyC(t.monthly) },
          { label: "Interest you earn", value: moneyC(t.interest) },
        ]}
        total={{ label: "Total you earn", value: moneyC(t.sellerTotal) }}
      />
    </div>
  );
}

const PHOTOS = [
  "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400",
  "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400",
];

const inspectionWindows = () =>
  Array.from({ length: 5 }, (_, i) => {
    const day = new Date(Date.now() + (i + 2) * 86_400_000).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    return [`${day} · 9 am to 12 pm`, `${day} · 1 pm to 5 pm`];
  }).flat();

const PAY_LABEL = { pending: "Not paid yet", processing: "Processing", paid: "Paid", failed: "Failed", refunded: "Refunded" } as const;

function InspectionBody({ d, detail, role, onRenegotiate, onCancel }: { d: DemoDeal; detail: DealDetailData; role: Role; onRenegotiate: () => void; onCancel: () => void }) {
  const store = useDemoStore();
  const act = useAct();
  const windows = inspectionWindows();
  const [win, setWin] = useState(windows[0] ?? "");
  const [where, setWhere] = useState("At the seller’s address");
  const b = detail.inspectionBooking;
  const seller = d.seller.split(" ")[0];
  const buyer = d.buyer.split(" ")[0];
  const fee = feeLabel();
  const steps = [
    ["Requested", !!b],
    ["Approved by the seller", b?.status === "approved"],
    ["Report ready", b?.status === "approved"],
  ] as const;
  const items = detail.inspection?.items ?? [];
  const notes = items.filter((i) => i.status === "wear").length;
  return (
    <>
      <ol aria-label="Inspection progress" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {steps.map(([l, done]) => (
          <li key={l} className="flex items-center gap-2">
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", done ? "bg-success text-white" : "bg-ink/10 text-muted")}>{done && <Check aria-hidden className="h-3 w-3" />}</span>
            <span className={done ? "font-medium" : "text-muted"}>{l}</span>
          </li>
        ))}
      </ol>

      {!b &&
        (role === "buyer" ? (
          <div className="space-y-3 rounded-2xl bg-surface p-4">
            <p className="font-semibold">Book a mobile inspection</p>
            <p className="text-sm text-muted">
              A mobile inspector checks the car. The inspection costs <strong className="text-ink">{fee}</strong>, paid by you. {seller} approves the time.
            </p>
            <NativeSelect label="When" value={win} onChange={(e) => setWin(e.target.value)} options={windows.map((w) => ({ value: w, label: w }))} />
            <TextInput label="Where is the car?" value={where} onChange={(e) => setWhere(e.target.value)} />
            <Button onClick={() => act(() => store.bookInspection(d.id, { window: win, location: where }), "Inspection requested")}>Request this time · {fee}</Button>
          </div>
        ) : (
          <p className="text-muted">Waiting for {buyer} to pick an inspection time.</p>
        ))}

      {b?.status === "requested" && (
        <div className="rounded-2xl bg-surface p-4">
          <p className="eyebrow text-muted">Requested</p>
          <p className="mt-1 font-semibold">{b.window}</p>
          <p className="text-sm text-muted">{b.location} · {fee}, paid by the buyer</p>
          {role === "seller" ? (
            <Button className="mt-3" onClick={() => act(() => store.approveInspectionBooking(d.id), "Inspection time approved")}>
              Approve this time
            </Button>
          ) : (
            <p className="mt-3 text-sm text-muted">Waiting for {seller} to approve the time.</p>
          )}
        </div>
      )}

      {b?.status === "approved" && (
        <>
          <div className="rounded-2xl border border-ink/10">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-4 py-3 text-sm">
              <span>
                <span className="block font-semibold">{detail.inspection?.inspector}</span>
                <span className="text-muted">{detail.inspection?.date}</span>
              </span>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", notes ? "bg-warning/15 text-warning" : "bg-success/10 text-success")}>{notes ? `Passed with ${notes} ${notes === 1 ? "note" : "notes"}` : "Passed"}</span>
            </div>
            <ul className="divide-y divide-ink/10">
              {items.map((i) => (
                <li key={i.name} className="flex items-start gap-3 px-4 py-3">
                  <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", i.status === "wear" ? "bg-warning" : "bg-success")} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{i.name}</span>
                    <span className="block text-sm text-muted">{i.note}</span>
                  </span>
                  <span className="text-xs font-semibold capitalize text-muted">{i.status}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 overflow-x-auto border-t border-ink/10 p-3">
              {PHOTOS.map((src, i) => (
                <img key={src} src={src} alt={`Inspection photo ${i + 1}`} className="h-20 w-28 shrink-0 rounded-lg object-cover" loading="lazy" />
              ))}
            </div>
            <div className="border-t border-ink/10 p-3">
              <Button size="sm" variant="secondary" leftIcon={<FileText aria-hidden className="h-4 w-4" />} onClick={() => act(() => undefined, "Demo: this would download the PDF report.")}>
                Download the PDF report
              </Button>
            </div>
          </div>
          {role === "buyer" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">What do you want to do?</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => act(() => store.decideInspection(d.id, "proceed"), "You chose to go ahead. The contract is next.")}>Proceed</Button>
                {canRenegotiate(detail.renegotiations ?? 0) ? (
                  <Button variant="secondary" onClick={onRenegotiate}>
                    Renegotiate
                  </Button>
                ) : (
                  <span className="self-center text-sm text-muted">You already renegotiated once.</span>
                )}
                <Button variant="ghost" onClick={onCancel}>
                  Cancel the deal
                </Button>
              </div>
              <p className="text-sm text-muted">Renegotiating sends you back to negotiation, once.</p>
            </div>
          ) : (
            <p className="text-sm text-muted">{buyer} decides after reading the report.</p>
          )}
        </>
      )}
    </>
  );
}

function ContractBody({ d, detail, role }: { d: DemoDeal; detail: DealDetailData; role: Role }) {
  const store = useDemoStore();
  const act = useAct();
  const t = termsFor(d);
  const [agree, setAgree] = useState(false);
  const [sig, setSig] = useState<SignatureValue | null>(null);
  const c = detail.contract;
  const mine = role === "seller" ? c?.sellerSigned : c?.buyerSigned;
  const mySig = role === "seller" ? c?.sellerSignature : c?.buyerSignature;
  const seller = d.seller.split(" ")[0];
  const buyer = d.buyer.split(" ")[0];
  return (
    <>
      {role === "buyer" ? (
        <div className="rounded-2xl border border-primary/25 bg-primary-50 p-4">
          <p className="eyebrow text-primary-700">In plain words</p>
          <p className="mt-1 text-lg font-semibold">
            You’ll pay {moneyC(t.monthly)}/month for {d.term} months. The seller keeps the lien until you finish paying.
          </p>
          <p className="mt-1 text-sm text-muted">You pay {moneyC(t.down)} down first. OwnerFi charges you no fees.</p>
        </div>
      ) : (
        <p className="text-muted">Read the financing agreement and bill of sale, then sign. Both of you sign online.</p>
      )}
      <div className="rounded-2xl bg-surface p-4">
        <p className="eyebrow text-muted">Financing agreement {c?.agreementNumber}</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li className="flex justify-between"><span>{d.seller}</span><span className={c?.sellerSigned ? "font-semibold text-success" : "text-muted"}>{c?.sellerSigned ? `Signed ${c.sellerSignedAt ?? ""}` : "Not signed"}</span></li>
          <li className="flex justify-between"><span>{d.buyer}</span><span className={c?.buyerSigned ? "font-semibold text-success" : "text-muted"}>{c?.buyerSigned ? `Signed ${c.buyerSignedAt ?? ""}` : "Not signed"}</span></li>
        </ul>
      </div>
      {!mine ? (
        <div className="space-y-3">
          <SignaturePad defaultName={role === "seller" ? d.seller : d.buyer} onChange={setSig} />
          <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} label="I’ve read the agreement and bill of sale, and I agree to sign them electronically." />
          <Button disabled={!agree || !sig} onClick={() => sig && act(() => store.signContract(d.id, role === "seller" ? "seller" : "buyer", sig), "Signed. Thank you.")}>
            Sign the contract
          </Button>
        </div>
      ) : (
        <div className="space-y-1 text-sm text-muted">
          <p>You signed. Waiting for {role === "seller" ? buyer : seller}.</p>
          {mySig && (
            <p className="num">
              Saved: {new Date(mySig.signedAt).toLocaleString()} · fingerprint {mySig.documentHash}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function DownPaymentBody({ d, detail, role, onPay }: { d: DemoDeal; detail: DealDetailData; role: Role; onPay: () => void }) {
  const t = termsFor(d);
  const buyer = d.buyer.split(" ")[0];
  const p = normalizePayment(detail.payment);
  const label = PAY_LABEL[p.status];
  return (
    <>
      <p className="text-muted">
        {role === "buyer"
          ? "You pay the down payment. The seller gets it minus the fee OwnerFi charges the seller. You pay no fees."
          : `${buyer} pays the down payment in the app. You get ${moneyC(t.sellerNet)} after OwnerFi’s fee.`}
      </p>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">Status</span>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", p.status === "paid" ? "bg-success/10 text-success" : p.status === "failed" ? "bg-danger/10 text-danger" : "bg-ink/[0.07] text-ink/70")}>{label}</span>
      </div>
      {p.status === "failed" && (
        <Alert tone="danger" title="The payment didn’t go through.">
          {p.lastError ?? "Payment declined"}. You weren’t charged. Try again, or use another method.
        </Alert>
      )}
      <Breakdown rows={[{ label: "Down payment", value: moneyC(t.down) }, ...(role === "seller" ? [{ label: "OwnerFi fee", value: `− ${moneyC(t.fee)}`, tone: "negative" as const }, { label: "You receive", value: moneyC(t.sellerNet) }] : [{ label: "OwnerFi fees for you", value: "$0" }])]} />
      {role === "buyer" && (
        <>
          <Button size="lg" disabled={p.status === "processing"} onClick={onPay}>
            {p.status === "processing" ? "Processing…" : p.status === "failed" ? `Try again · ${moneyC(t.down)}` : `Pay ${moneyC(t.down)}`}
          </Button>
          <p className="text-sm text-muted">Fully refunded if the deal doesn’t close.</p>
        </>
      )}
    </>
  );
}

function ClosingBody({ d, detail, role }: { d: DemoDeal; detail: DealDetailData; role: Role }) {
  const store = useDemoStore();
  const act = useAct();
  const [file, setFile] = useState("");
  const cl = detail.closing;
  const me = role === "seller" ? "seller" : "buyer";
  const mine = me === "seller" ? cl?.sellerConfirmed : cl?.buyerConfirmed;
  const theirs = me === "seller" ? cl?.buyerConfirmed : cl?.sellerConfirmed;
  const other = (me === "seller" ? d.buyer : d.seller).split(" ")[0];
  const rows: [string, boolean | undefined][] = [
    ["Seller confirmed the title transfer", cl?.sellerConfirmed],
    ["Buyer confirmed the title transfer", cl?.buyerConfirmed],
  ];
  return (
    <>
      <p className="text-muted">Meet at the DMV or a title agency. Move the title, with the seller recorded as lienholder. The loan starts only when you both confirm.</p>
      <ul className="space-y-2">
        {rows.map(([l, v]) => (
          <li key={l} className="flex items-center gap-2 text-sm">
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", v ? "bg-success text-white" : "bg-ink/10 text-muted")}>{v && <Check aria-hidden className="h-3 w-3" />}</span>
            {l}
          </li>
        ))}
      </ul>
      {(cl?.evidence ?? []).length > 0 && (
        <ul className="space-y-1 text-sm text-muted">
          {cl?.evidence?.map((e) => (
            <li key={e.by + e.at} className="flex items-center gap-2">
              <FileText aria-hidden className="h-4 w-4" /> {e.by === "seller" ? "Seller" : "Buyer"} added {e.name}
            </li>
          ))}
        </ul>
      )}
      {role === "admin" ? null : !mine ? (
        <div className="space-y-3 rounded-2xl bg-surface p-4">
          <label className="block text-sm font-medium">
            Add evidence (a photo of the signed title or the DMV receipt)
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} className="mt-2 block w-full text-sm" />
          </label>
          {file ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <Check aria-hidden className="h-4 w-4" /> {file}
            </p>
          ) : (
            <button type="button" className="text-sm font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setFile("signed-title-sample.jpg")}>
              Use a sample photo (demo)
            </button>
          )}
          <Button disabled={!file} onClick={() => act(() => store.confirmClosing(d.id, me, file), "Confirmed. We’ll start the loan when " + other + " confirms too.")}>
            I confirm the title moved
          </Button>
          {theirs && <p className="text-sm text-muted">{other} already confirmed.</p>}
        </div>
      ) : (
        <p className="text-sm text-muted">You confirmed. Waiting for {other} to confirm.</p>
      )}
    </>
  );
}

function OfferHistory({ detail }: { detail: DealDetailData }) {
  const offers = offersOf(detail);
  if (offers.length < 2) return null;
  const base = detail.roundBase ?? 0;
  return (
    <details className="rounded-2xl border border-ink/10 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium">All offers so far ({offers.length - base})</summary>
      <ol className="mt-2 space-y-1">
        {offers.slice(base).map((o) => (
          <li key={o.version} className={cn("flex flex-wrap justify-between gap-2", o.status !== "current" && "text-muted")}>
            <span>
              v{o.version} · {o.by === "buyer" ? "Buyer" : "Seller"} · {moneyC(o.terms.priceCents)}, {o.terms.downPct}% down, {o.terms.apr}% for {o.terms.term} mo
            </span>
            <span className="capitalize">{o.status}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function useAct() {
  const toast = useToast();
  return (fn: () => void, msg: string) => {
    try {
      fn();
      toast({ tone: "success", title: msg });
    } catch (e) {
      toast({ tone: "danger", title: e instanceof RuleError || e instanceof Error ? e.message : "That didn’t work. Try again." });
    }
  };
}

function StageCard({ d, detail, role }: { d: DemoDeal; detail: DealDetailData; role: Role }) {
  const store = useDemoStore();
  const act = useAct();
  const [counter, setCounter] = useState<false | "counter" | "renegotiate">(false);
  const [decline, setDecline] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [pay, setPay] = useState<"down" | "month" | null>(null);
  const t = termsFor(d);
  const seller = d.seller.split(" ")[0];
  const buyer = d.buyer.split(" ")[0];
  const idx = STAGES.indexOf(d.stage as (typeof STAGES)[number]);
  let body: ReactNode = null;

  const runPay = (fn: () => void) => () => {
    if (demoFlags.get().payFails) {
      demoFlags.set({ payFails: false });
      if (pay === "down") store.failDownPayment(d.id);
      else store.failInstallment(d.id);
      throw new Error("Payment declined");
    }
    fn();
  };

  const paid = detail.payment?.status === "paid";
  const mayCancel = role !== "admin" && canCancel(d.stage) && ["inspection", "contract", "down_payment", "closing"].includes(d.stage);

  switch (d.stage) {
    case "inquiry":
      body = (
        <>
          <p className="text-muted">{role === "seller" ? `${buyer} asked about the car. Answer in messages, then invite them to a test drive.` : `Ask ${seller} anything about the car in messages. They’ll reply soon.`}</p>
          {role === "seller" ? (
            <Button onClick={() => act(() => store.confirmTestDrive(d.id), "Test drive set up")}>Invite to a test drive</Button>
          ) : (
            <ButtonLink variant="secondary" to="/buyer/inbox">
              Open messages
            </ButtonLink>
          )}
        </>
      );
      break;
    case "test_drive":
      body = (
        <>
          <div className="rounded-2xl bg-surface p-4">
            <p className="eyebrow text-muted">Test drive</p>
            <p className="num mt-1 font-semibold">{detail.testDrive?.slot ?? "Time to be agreed"}</p>
            <p className="text-sm text-muted">{detail.testDrive?.location}</p>
          </div>
          {role === "seller" ? (
            <div className="flex flex-wrap gap-2">
              {detail.testDrive?.status !== "confirmed" && <Button onClick={() => act(() => store.confirmTestDrive(d.id), "Test drive confirmed")}>Confirm the time</Button>}
              <Button variant={detail.testDrive?.status === "confirmed" ? "primary" : "secondary"} onClick={() => act(() => store.completeTestDrive(d.id), "Test drive done. Ready for an offer.")}>
                Mark as done
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">After the drive, {seller} marks it done and you can make an offer.</p>
          )}
        </>
      );
      break;
    case "application":
    case "negotiation": {
      const offers = offersOf(detail);
      const cur = currentOffer(offers);
      const sellerCounter = (cur?.by ?? detail.counterOffer?.proposedBy) === "seller";
      const base = detail.roundBase ?? 0;
      const can = canSubmitOffer(offers, base);
      body = (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>{sellerCounter ? (role === "buyer" ? `${seller} sent a counter-offer. Your move.` : `Waiting for ${buyer} to answer.`) : role === "seller" ? `${buyer} sent an offer. Your move.` : `${seller} is reviewing your offer.`}</p>
            <span className="num rounded-full bg-ink/[0.07] px-3 py-1 text-xs font-semibold">Round {Math.max(1, roundsUsed(offers, base))} of {maxRounds()}</span>
          </div>
          <Terms d={d} detail={detail} />
          <OfferHistory detail={detail} />
          {!can.ok && role !== "admin" && ((role === "seller" && !sellerCounter) || (role === "buyer" && sellerCounter)) && <Alert tone="warning">{can.reason}</Alert>}
          {role === "seller" && !sellerCounter && <RiskSummary buyer={d.buyer} />}
          <div className="flex flex-wrap items-center gap-2">
            {role === "seller" && !sellerCounter && (
              <>
                <Button onClick={() => act(() => store.approveOffer(d.id), "Terms approved. Inspection is next.")}>Approve terms</Button>
                {can.ok && (
                  <Button variant="secondary" onClick={() => setCounter("counter")}>
                    Counter
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setDecline(true)}>
                  Decline
                </Button>
              </>
            )}
            {role === "buyer" && sellerCounter && (
              <>
                <Button onClick={() => act(() => store.acceptCounterOffer(d.id, cur?.version), "Terms agreed. Inspection is next.")}>Accept these terms</Button>
                {can.ok && (
                  <Button variant="secondary" onClick={() => setCounter("counter")}>
                    Counter back
                  </Button>
                )}
              </>
            )}
            {role === "buyer" && (
              <Button variant="ghost" onClick={() => setCancel(true)}>
                Withdraw
              </Button>
            )}
          </div>
          {role === "seller" && !sellerCounter && <EarnPreview d={d} />}
        </>
      );
      break;
    }
    case "inspection":
      body = <InspectionBody d={d} detail={detail} role={role} onRenegotiate={() => setCounter("renegotiate")} onCancel={() => setCancel(true)} />;
      break;
    case "contract":
      body = <ContractBody d={d} detail={detail} role={role} />;
      break;
    case "down_payment":
      body = <DownPaymentBody d={d} detail={detail} role={role} onPay={() => setPay("down")} />;
      break;
    case "closing":
      body = <ClosingBody d={d} detail={detail} role={role} />;
      break;
    case "active": {
      const inst = detail.installment;
      body = (
        <>
          <Alert tone={d.late ? "danger" : "success"} title={d.late ? "A payment is late." : "Payments are on schedule."}>
            {inst ? `${inst.paidCount} of ${inst.totalCount} paid · next due ${inst.nextDueDate}` : ""}
          </Alert>
          <div className="flex flex-wrap gap-2">
            {role === "buyer" ? (
              <>
                <Button onClick={() => setPay("month")}>Pay this month ({moneyC(t.monthly)})</Button>
                <ButtonLink variant="secondary" to="/buyer/payments">Payments and autopay</ButtonLink>
              </>
            ) : role === "admin" ? null : (
              <>
                <ButtonLink variant="secondary" to="/seller/payments">See payments</ButtonLink>
                {d.late && <ButtonLink variant="secondary" to={`/seller/deals/${d.id}/default-options`}>See your options</ButtonLink>}
              </>
            )}
          </div>
        </>
      );
      break;
    }
    case "paid_off": {
      const lien = detail.lien;
      const released = !!lien?.releasedAt;
      body = (
        <>
          <Alert tone="success" title={released ? "Lien released. The title is free and clear." : "Paid off."}>
            {released
              ? "The buyer owns the car outright."
              : role === "seller"
                ? "Release the lien so the title is fully the buyer’s."
                : `${seller} releases the lien. The car is yours free and clear.`}
          </Alert>
          {role === "seller" && !released && (
            <Button onClick={() => act(() => store.releaseLien(d.id), "Lien released. The buyer was told.")}>Release the lien</Button>
          )}
          {role === "buyer" && !released && <p className="text-sm text-muted">We’ll tell you the moment {seller} confirms.</p>}
        </>
      );
      break;
    }
    case "declined":
      body = <Alert tone="info" title="This offer was declined.">You can keep looking. Nothing else happens on this deal.</Alert>;
      break;
    case "cancelled": {
      const c = detail.cancellation;
      body = (
        <>
          <Alert tone="info" title={c ? `This deal was cancelled by ${c.by === "admin" ? "OwnerFi" : c.by === "buyer" ? buyer : seller}.` : "This deal was cancelled."}>
            {c?.reason ? `${c.reason}. ` : ""}Nothing else happens on this deal.
          </Alert>
          {c && c.refundCents > 0 && (
            <Breakdown
              rows={[
                { label: "Down payment refunded to the buyer", value: moneyC(c.refundCents) },
                { label: "Including OwnerFi’s fee", hint: "Fees are refunded too (test mode).", value: moneyC(t.fee) },
              ]}
            />
          )}
          {c?.relisted && <p className="text-sm text-muted">The car is back on the market.</p>}
        </>
      );
      break;
    }
    default:
      body = <p className="text-muted">Nothing more to do here.</p>;
  }

  return (
    <Card id="current-step" className="scroll-mt-24">
      <p className="eyebrow text-primary">{idx >= 0 ? `Step ${idx + 1} · Now` : "Closed"}</p>
      <h2 className="mt-1 text-2xl font-bold">{idx >= 0 ? LABELS[d.stage as keyof typeof LABELS] : d.stage === "declined" ? "Declined" : "Cancelled"}</h2>
      <div className="mt-4 space-y-4">{body}</div>
      {mayCancel && d.stage !== "inspection" && (
        <div className="mt-5 border-t border-ink/10 pt-4">
          <Button variant="ghost" size="sm" onClick={() => setCancel(true)} leftIcon={<X aria-hidden className="h-4 w-4" />}>
            Cancel this deal
          </Button>
          <p className="mt-1 text-xs text-muted">{paid ? "The buyer gets the whole down payment back, fee included." : "Nothing has been paid yet."}</p>
        </div>
      )}
      {counter && <CounterModal d={d} role={role} renegotiate={counter === "renegotiate"} onClose={() => setCounter(false)} />}
      {decline && (
        <ReasonModal
          title="Decline this offer?"
          description={`We’ll tell ${buyer}.`}
          confirm="Decline"
          danger
          reasons={["Down payment is too low", "Terms don’t work for me", "I found another buyer"]}
          onClose={() => setDecline(false)}
          onConfirm={(r) => {
            store.declineDeal(d.id, r);
            setDecline(false);
            act(() => undefined, "Offer declined");
          }}
        />
      )}
      {cancel && (
        <ReasonModal
          title={paid ? "Cancel this deal and refund the buyer?" : role === "buyer" ? "Cancel and walk away?" : "Cancel this deal?"}
          description={
            paid
              ? `${buyer} gets the whole down payment (${moneyC(t.down)}) back, including OwnerFi’s fee. The car goes back on the market.`
              : `We’ll tell ${role === "buyer" ? seller : buyer}. The car goes back on the market.`
          }
          confirm="Cancel the deal"
          danger
          reasons={role === "buyer" ? ["I changed my mind", "I found another car", "The terms don’t work for me"] : ["The buyer isn’t responding", "I sold it another way", "I changed my mind"]}
          onClose={() => setCancel(false)}
          onConfirm={(r) => {
            setCancel(false);
            act(() => store.cancelDeal(d.id, role === "admin" ? "admin" : role, r || undefined), paid ? "Cancelled. The down payment is refunded." : "Deal cancelled");
          }}
        />
      )}
      {pay && (
        <PayModal
          open
          onClose={() => setPay(null)}
          title={pay === "down" ? "Pay the down payment" : `Pay ${shortCar(d.car)}`}
          amount={pay === "down" ? t.down : t.monthly}
          sellerName={seller ?? "the seller"}
          doneText={`${moneyC(pay === "down" ? t.down : t.monthly)} is on its way to ${seller}.`}
          run={runPay(() => {
            if (pay === "down") store.payDownPayment(d.id);
            else store.payInstallment(d.id);
            notify("u-maria", "payment_received", { title: pay === "down" ? "Down payment received" : "Payment received", body: `${d.buyer} paid ${moneyC(pay === "down" ? t.down : t.monthly)}.`, href: "/seller/payments", tag: "receipt" });
          })}
        />
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------- page */

function SoFar({ d, detail }: { d: DemoDeal; detail: DealDetailData }) {
  const idx = STAGES.indexOf(d.stage as (typeof STAGES)[number]);
  const t = termsFor(d);
  const info: Record<string, string> = {
    inquiry: "Questions answered in messages.",
    test_drive: detail.testDrive ? `Test drive: ${detail.testDrive.slot}.` : "Test drive done.",
    application: `Offer: ${moneyC(d.priceCents)}, ${d.downPct}% down, ${percent(d.apr)} for ${d.term} months.`,
    negotiation: `Agreed: ${moneyC(t.monthly)}/mo for ${d.term} months.`,
    inspection: detail.inspection ? `Report from ${detail.inspection.inspector}.` : "Inspection done.",
    contract: detail.contract ? `Agreement ${detail.contract.agreementNumber} signed.` : "Contract signed.",
    down_payment: `Down payment of ${moneyC(t.down)} paid.`,
    closing: "Title moved and handover confirmed.",
    active: "Monthly payments started.",
  };
  const done = STAGES.slice(0, Math.max(0, idx)).filter((s) => info[s]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader title="The deal so far" description="Every finished step, in order." />
      {done.length === 0 ? (
        <p className="text-sm text-muted">Finished steps show up here.</p>
      ) : (
        <ol className="divide-y divide-ink/10">
          {done.map((s, i) => (
            <li key={s} className="py-3 first:pt-0 last:pb-0">
              <button type="button" aria-expanded={open === s} onClick={() => setOpen(open === s ? null : s)} className="flex w-full items-center justify-between text-left">
                <span className="font-medium">
                  {i + 1}. {LABELS[s]}
                </span>
                <span className="flex items-center gap-1 text-sm text-primary">
                  Details <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", open === s && "rotate-180")} />
                </span>
              </button>
              {open === s && <p className="mt-1 text-sm text-muted">{info[s]}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Chat({ d, detail, role }: { d: DemoDeal; detail: DealDetailData; role: Role }) {
  const { sendMessage } = useDemoStore();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const me = role === "seller" ? "seller" : "buyer";
  const user = useCurrentUser();
  const blocked = role !== "admin" && user && !user.emailVerified ? "Verify your email to send messages." : "";
  const send = () => {
    if (!text.trim() || blocked) return;
    sendMessage(d.id, me, text.trim());
    setText("");
    window.setTimeout(() => end.current?.scrollIntoView({ block: "end" }), 50);
  };
  return (
    <Card id="messages" className="scroll-mt-24">
      <CardHeader title="Messages" action={role === "admin" ? undefined : <AppLink to={`/${role}/inbox`} className="text-sm font-semibold text-primary hover:underline">Open inbox</AppLink>} />
      <div className="max-h-72 space-y-3 overflow-y-auto">
        {detail.messages.length === 0 && <p className="text-sm text-muted">No messages yet. Say hello.</p>}
        {detail.messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col", m.sender === me ? "items-end" : "items-start")}>
            <p className={cn("max-w-[90%] rounded-2xl px-3 py-2 text-sm", m.sender === me ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-surface")}>{m.text}</p>
            <span className="mt-0.5 text-xs text-muted">{m.time}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      {role !== "admin" && <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          aria-label="Write a message"
          value={text}
          disabled={!!blocked}
          onChange={(e) => setText(e.target.value)}
          placeholder={blocked || "Write a message"}
          className="h-11 min-w-0 flex-1 rounded-xl border border-ink/15 px-3.5 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
        />
        <Button type="submit" disabled={!text.trim() || !!blocked} aria-label="Send" leftIcon={<Send aria-hidden className="h-4 w-4" />}>
          Send
        </Button>
      </form>}
      {role !== "admin" && <p className="mt-3 text-sm text-muted">
        Need help? <AppLink to="/demo/inbox" className="font-medium text-primary hover:underline">Contact support</AppLink>
      </p>}
    </Card>
  );
}

/** The Deal Room itself. Used by /deals/:id (seller, buyer) and /admin/deals/:id (admin, with a toolbar). */
export function DealRoomBody({ id, role, fallback, toolbar, back }: { id: string; role: Role; fallback?: DemoDeal | undefined; toolbar?: ReactNode; back?: { to: string; label: string } }) {
  const { getDeal, getDealDetail } = useDemoStore();
  const d = getDeal(id) ?? fallback;
  if (!d) return null;
  const detail = getDealDetail(id);
  const t = termsFor(d);
  const idx = STAGES.indexOf(d.stage as (typeof STAGES)[number]);
  const closed = idx < 0;
  const next = getNextAction(d, role, detail);
  const other = role === "seller" ? d.buyer : d.seller;
  const backTo = back ?? { to: role === "admin" ? "/admin/deals" : `/${role}/deals`, label: role === "admin" ? "All deals" : "All deals" };

  const steps = STAGES.map((s, i) => ({
    id: s,
    label: LABELS[s],
    state: (closed ? (i < 2 ? "done" : "upcoming") : i < idx ? "done" : i === idx ? "current" : "upcoming") as "done" | "current" | "upcoming",
  }));

  const docs =
    idx >= STAGES.indexOf("contract")
      ? [
          { name: "Financing agreement", note: detail.contract?.agreementNumber ?? "" },
          { name: "Bill of sale", note: "Generated from your terms" },
        ]
      : [];

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-5 pb-24 xl:pb-0">
        <AppLink to={backTo.to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" /> {backTo.label}
        </AppLink>
        {toolbar}
        <Card padding="none">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:p-6">
            <CarImage src={d.photo} alt={d.car} className="h-24 w-32 shrink-0 !rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold md:text-[28px]">{shortCar(d.car)}</h1>
                <StatusChip kind="deal" value={d.stage} />
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                {role === "seller" ? "Selling to" : role === "buyer" ? "Buying from" : "Seller"} <strong className="text-ink">{role === "admin" ? d.seller : other}</strong>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700">
                  <BadgeCheck aria-hidden className="h-4 w-4" /> Verified
                </span>
                {role === "admin" && <span>· Buyer <strong className="text-ink">{d.buyer}</strong></span>}
              </p>
              <p className="mt-1 text-sm text-muted">{["declined", "cancelled"].includes(d.stage) ? "This deal is closed." : idx < 2 ? "Terms aren’t agreed yet." : `Terms: ${moneyC(t.monthly)}/mo for ${d.term} months.`}</p>
            </div>
          </div>
          <div className="border-t border-ink/[0.08] bg-surface/60 px-5 py-4 md:px-6">
            {!closed && <p className="num mb-3 text-sm font-semibold md:hidden">Step {idx + 1} of 10</p>}
            <Stepper steps={steps} />
          </div>
        </Card>

        {next.who === "you" && (
          <div className="flex items-center gap-4 rounded-2xl bg-primary-50 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
              <Sparkles aria-hidden className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-primary-700">Your next step</p>
              <p className="font-semibold">{next.label}</p>
            </div>
            <a href="#current-step" className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink/15 bg-white px-5 text-[15px] font-semibold shadow-card hover:bg-surface">
              Go to step <ArrowRight aria-hidden className="h-4 w-4" />
            </a>
          </div>
        )}
        {next.who === "other" && <Alert tone="info">{next.text}</Alert>}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            <StageCard d={d} detail={detail} role={role} />
            <SoFar d={d} detail={detail} />
          </div>
          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24" aria-label="Deal details">
            {role !== "admin" && (
              <Card>
                <CardHeader title="Who goes next" />
                <p className={cn("font-semibold", next.waitingOn === "you" ? "text-primary" : "text-ink")}>
                  {next.waitingOn === "you" ? "You" : next.waitingOn === "other" ? other.split(" ")[0] : closed ? "No one" : "OwnerFi"}
                </p>
                <p className="mt-0.5 text-sm text-muted">{next.text || "Nothing more to do."}</p>
              </Card>
            )}
            <Card>
              <CardHeader title="The numbers" description="Monthly payments go straight to the seller. OwnerFi takes no cut of them." />
              <Breakdown
                rows={[
                  { label: "Price", value: moneyC(d.priceCents) },
                  { label: "Down payment", value: moneyC(t.down) },
                  { label: "OwnerFi fee", hint: "10% of the down payment. Taken from the seller’s side.", value: `− ${moneyC(t.fee)}`, tone: "negative" },
                  { label: "Seller receives at closing", value: moneyC(t.sellerNet) },
                  { label: "Amount financed", value: moneyC(t.financed) },
                  { label: "Monthly payment", hint: `${d.term} months at ${percent(d.apr)}`, value: moneyC(t.monthly) },
                  { label: "Total interest", value: moneyC(t.interest) },
                ]}
                total={{ label: "Total seller receives", value: moneyC(t.sellerTotal) }}
              />
            </Card>
            <Card>
              <CardHeader title="People" />
              <ul className="space-y-3">
                {[
                  { n: d.seller, r: "Seller · AZ", you: role === "seller" },
                  { n: d.buyer, r: "Buyer · AZ", you: role === "buyer" },
                ].map((p) => (
                  <li key={p.n} className="flex items-center gap-3">
                    <Avatar name={p.n} size="sm" />
                    <span>
                      <span className="block font-medium">
                        {p.n} {p.you && "(you)"}
                      </span>
                      <span className="block text-sm text-muted">{p.r}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Documents" />
              {docs.length === 0 ? (
                <p className="text-sm text-muted">Documents appear here as the deal moves forward.</p>
              ) : (
                <ul className="divide-y divide-ink/10">
                  {docs.map((x) => (
                    <li key={x.name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <FileText aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{x.name}</span>
                        <span className="block truncate text-sm text-muted">{x.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Activity" />
              <ul className="space-y-3 text-sm">
                {[...detail.messages].reverse().slice(0, 4).map((m) => (
                  <li key={m.id}>
                    <span className="font-medium">{m.senderName.split(" ")[0]}</span> · {m.text}
                    <span className="block text-xs text-muted">{m.time}</span>
                  </li>
                ))}
                <li>
                  <span className="font-medium">Now</span> · {closed ? "Deal closed" : `On step ${idx + 1}: ${LABELS[d.stage as keyof typeof LABELS]}`}
                  <span className="block text-xs text-muted">{d.updated}</span>
                </li>
              </ul>
            </Card>
            <Chat d={d} detail={detail} role={role} />
          </aside>
        </div>
      </div>
      {next.who === "you" && !closed && role !== "admin" && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-ink/10 bg-white/95 px-4 py-3 shadow-raised backdrop-blur-md lg:bottom-0 xl:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-primary-700">Your next step</p>
              <p className="truncate font-semibold">{next.label}</p>
            </div>
            <a href="#current-step" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-white">
              Go <ArrowRight aria-hidden className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </>
  );
}
