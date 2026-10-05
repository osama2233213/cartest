import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileCheck2,
  FileSignature,
  FileText,
  Handshake,
  HelpCircle,
  KeyRound,
  Lock,
  MapPin,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wrench,
} from "lucide-react";
import { AppShell, StageChip } from "@/components/app/AppShell";
import { CarPhoto } from "@/components/site/CarPhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEALS,
  STAGES,
  STAGE_LABEL,
  getNextAction,
  termsFor,
  type Role,
  type DemoDeal,
  type Stage,
  PERSONAS,
} from "@/lib/demo-data";
import { dealTerms, fmtUsd } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { useDemoStore, type DealDetailData } from "@/lib/demo-store";
import { toast } from "sonner";

function findLocalDeal(id: string): DemoDeal | undefined {
  if (typeof window === "undefined") {
    return DEALS.find((x) => x.id === id);
  }
  try {
    const raw = localStorage.getItem("ownerfi_demo_store_v2");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.deals)) {
        const found = parsed.deals.find((x: DemoDeal) => x.id === id);
        if (found) return found;
      }
    }
  } catch {
    // ignore
  }
  return DEALS.find((x) => x.id === id);
}

export const Route = createFileRoute("/deals/$id")({
  validateSearch: z.object({ as: z.enum(["seller", "buyer", "admin"]).catch("buyer") }),
  loader: ({ params }) => {
    const d = findLocalDeal(params.id);
    if (!d) {
      if (typeof window === "undefined" && (params.id.startsWith("d-") || params.id.startsWith("d"))) {
        return {
          id: params.id,
          car: "2021 Toyota Camry SE",
          photo: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800",
          seller: "Maria Alvarez",
          buyer: "Daniel Park",
          stage: "inquiry" as Stage,
          priceCents: 2100000,
          downPct: 15,
          apr: 9.0,
          term: 48,
          updated: "Just now",
        };
      }
      throw notFound();
    }
    return d;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.car} — Deal Room (Demo) — OwnerFi` : "Deal Room — OwnerFi";
    return {
      meta: [
        { title: t },
        { name: "description", content: "Interactive OwnerFi Deal Room with live state transitions." },
        { property: "og:title", content: t },
        { property: "og:description", content: "Interactive OwnerFi Deal Room." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: DealRoom,
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <h2 className="text-xl font-bold text-ink">Deal not found</h2>
      <p className="mt-2 text-sm text-muted-foreground">This deal may have expired or was reset.</p>
      <Link to="/seller" className="mt-4 inline-block text-primary underline">Return to dashboard</Link>
    </div>
  ),
  errorComponent: () => <p className="p-16 text-center">Couldn't load this deal.</p>,
});

function DealRoom() {
  const loaderData = Route.useLoaderData();
  const { as: currentRole } = Route.useSearch();
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const {
    getDeal,
    getDealDetail,
    sendMessage,
    confirmTestDrive,
    completeTestDrive,
    approveOffer,
    submitCounterOffer,
    acceptCounterOffer,
    acceptInspection,
    signContract,
    payDownPayment,
    confirmClosing,
    payInstallment,
  } = useDemoStore();

  const d = getDeal(id) || loaderData;
  const detail = getDealDetail(id);
  const t = termsFor(d);
  const role = currentRole as Role;

  // Counter-offer modal state
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterPriceDollars, setCounterPriceDollars] = useState(Math.round(d.priceCents / 100));
  const [counterDownPct, setCounterDownPct] = useState(d.downPct);
  const [counterApr, setCounterApr] = useState(d.apr);
  const [counterTerm, setCounterTerm] = useState(d.term);
  const [counterNote, setCounterNote] = useState("We can meet in the middle at these terms.");

  // Chat message input state
  const [newMsg, setNewMsg] = useState("");

  // Payment processing animation state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Stepper state
  const idx = STAGES.indexOf(d.stage as (typeof STAGES)[number]);
  const back = role === "seller" ? "/seller" : role === "buyer" ? "/buyer" : "/admin";

  // Dynamic Who goes next calculation
  const nextInfo = getDynamicNextAction(d, detail, role);

  // Counter calculation preview
  const counterCalc = dealTerms({
    priceCents: counterPriceDollars * 100,
    downPct: counterDownPct,
    apr: counterApr,
    termMonths: counterTerm,
  });

  const handleSendChat = () => {
    if (!newMsg.trim()) return;
    sendMessage(d.id, role === "seller" ? "seller" : "buyer", newMsg);
    setNewMsg("");
  };

  const handleApprove = () => {
    approveOffer(d.id);
    toast.success("Offer approved!", {
      description: "Inspection scheduled. Mechanics report is ready to review.",
    });
  };

  const handleCounterSubmit = () => {
    submitCounterOffer(
      d.id,
      {
        priceCents: counterPriceDollars * 100,
        downPct: counterDownPct,
        apr: counterApr,
        term: counterTerm,
      },
      role === "seller" ? "seller" : "buyer",
      counterNote
    );
    setCounterOpen(false);
    toast.success("Counter-offer sent successfully!");
  };

  const handleAcceptCounter = () => {
    acceptCounterOffer(d.id);
    toast.success("Terms accepted! Deal moved to vehicle inspection.");
  };

  const handleAcceptInspection = () => {
    acceptInspection(d.id);
    toast.success("Inspection approved! State financing agreement prepared.");
  };

  const handleSign = () => {
    signContract(d.id, role === "seller" ? "seller" : "buyer");
    toast.success("Agreement e-signed successfully!", {
      description: "Recorded with OwnerFi Digital Signing.",
    });
  };

  const handlePayDownPayment = () => {
    setIsProcessingPayment(true);
    setTimeout(() => {
      payDownPayment(d.id);
      setIsProcessingPayment(false);
      toast.success("Down payment processed successfully!", {
        description: `${fmtUsd(t.down)} transferred. Move to vehicle closing & handoff.`,
      });
    }, 900);
  };

  const handleConfirmClosing = () => {
    confirmClosing(d.id);
    toast.success("Handoff confirmed! Loan is now ACTIVE.", {
      description: "Title recorded with OwnerFi lien. Monthly installment schedule started.",
    });
  };

  const handlePayInstallment = () => {
    payInstallment(d.id);
    toast.success("Monthly installment payment processed!", {
      description: "Receipt issued. Account remains in good standing.",
    });
  };

  return (
    <AppShell
      role={role}
      nav={
        <div className="flex items-center gap-4">
          <Link to={back} className="text-muted-foreground hover:text-ink">
            ← Back to dashboard
          </Link>
          <span className="text-border">|</span>
          <span className="font-semibold text-ink">Deal Room: {d.car}</span>
        </div>
      }
    >
      {/* Vehicle Summary Header Bar */}
      <div className="card-surface flex flex-wrap items-center justify-between gap-4 p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <CarPhoto src={d.photo} alt={d.car} className="size-16 shrink-0 rounded-xl object-cover shadow-inner" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink">{d.car}</h1>
              <StageChip stage={d.stage} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Seller <strong className="text-ink">{d.seller}</strong> (Verified) · Buyer <strong className="text-ink">{d.buyer}</strong> (Verified)
            </p>
          </div>
        </div>

        {/* Quick Role Switcher Buttons inside the room */}
        <div className="flex items-center gap-2 rounded-xl bg-surface p-1.5 border border-border">
          <span className="text-[11px] font-semibold text-muted-foreground px-2">Viewing as:</span>
          <button
            onClick={() => navigate({ to: "/deals/$id", params: { id: d.id }, search: { as: "seller" } })}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              role === "seller" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-ink"
            )}
          >
            Maria (Seller)
          </button>
          <button
            onClick={() => navigate({ to: "/deals/$id", params: { id: d.id }, search: { as: "buyer" } })}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              role === "buyer" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-ink"
            )}
          >
            Daniel (Buyer)
          </button>
        </div>
      </div>

      {/* 10-Stage Horizontal Stepper */}
      <ol className="mt-6 flex gap-1 overflow-x-auto pb-2">
        {STAGES.map((s, i) => {
          const done = idx > i;
          const cur = idx === i;
          return (
            <li
              key={s}
              className={cn(
                "flex min-w-24 flex-1 flex-col items-center gap-1 rounded-xl p-2 text-center text-xs transition-all",
                cur
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : done
                    ? "bg-success/10 text-success"
                    : "bg-background text-muted-foreground border border-border"
              )}
            >
              {done ? (
                <Check className="size-4" />
              ) : cur ? (
                <span className="size-4 rounded-full border-2 border-current animate-pulse" />
              ) : (
                <Lock className="size-3.5 opacity-60" />
              )}
              <span className="truncate">{STAGE_LABEL[s]}</span>
            </li>
          );
        })}
      </ol>

      {/* Main Grid: Left Stage Action Panel + Right Summary Sidebars */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left Interactive Stage Card */}
        <div className="space-y-6">
          <section className="card-surface p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Current Stage</span>
                <h2 className="text-2xl font-bold text-ink mt-0.5">{STAGE_LABEL[d.stage]}</h2>
              </div>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted-foreground border border-border">
                Step {idx + 1} of 10
              </span>
            </div>

            {/* STAGE 1: INQUIRY */}
            {d.stage === "inquiry" && (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  The buyer has asked a question about this vehicle. Once terms or questions are aligned, you can invite them to a test drive.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  {role === "seller" ? (
                    <Button
                      onClick={() => {
                        confirmTestDrive(d.id);
                        toast.success("Test drive scheduled! Progressed to Test Drive stage.");
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <Calendar className="size-4" /> Schedule test drive with buyer
                    </Button>
                  ) : (
                    <div className="rounded-xl bg-surface p-4 text-xs text-muted-foreground border border-border w-full flex items-center justify-between">
                      <span>Waiting for seller Maria to reply to your question...</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate({ to: "/deals/$id", params: { id: d.id }, search: { as: "seller" } })}
                      >
                        Switch to Maria to reply
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 2: TEST DRIVE */}
            {d.stage === "test_drive" && (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between font-semibold text-ink">
                    <span className="flex items-center gap-2">
                      <Calendar className="size-4 text-primary" /> Test Drive Appointment
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary font-bold">
                      {detail.testDrive?.status === "confirmed" ? "Confirmed ✓" : "Pending Seller Confirmation"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Time: <strong className="text-ink">{detail.testDrive?.slot || "Tomorrow · 2:00 PM"}</strong> · Location:{" "}
                    <strong className="text-ink">{detail.testDrive?.location || "Camelback Rd, Phoenix, AZ"}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {role === "seller" ? (
                    <>
                      {detail.testDrive?.status !== "confirmed" && (
                        <Button onClick={() => confirmTestDrive(d.id)}>
                          <Check className="size-4 mr-1.5" /> Confirm test drive appointment
                        </Button>
                      )}
                      <Button
                        variant={detail.testDrive?.status === "confirmed" ? "default" : "outline"}
                        onClick={() => completeTestDrive(d.id)}
                      >
                        <CheckCircle2 className="size-4 mr-1.5" /> Mark test drive completed
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 w-full rounded-xl bg-surface p-4 border border-border text-xs">
                      <span className="text-muted-foreground">
                        {detail.testDrive?.status === "confirmed"
                          ? "Seller has confirmed your test drive! Once you inspect the car, mark it completed."
                          : "Test drive request submitted. Switch to Maria to confirm time slot."}
                      </span>
                      <Button size="sm" onClick={() => completeTestDrive(d.id)}>
                        Mark completed & review offer
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 3 & 4: APPLICATION & NEGOTIATION */}
            {(d.stage === "application" || d.stage === "negotiation") && (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Proposed Deal Terms</span>
                    <span className="text-xs font-semibold text-primary">
                      {detail.counterOffer?.proposedBy === "seller" ? "Seller Counter-Offer" : "Buyer Application"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm border-t border-border pt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Purchase Price</p>
                      <p className="money font-bold text-ink">{fmtUsd(d.priceCents)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Down Payment</p>
                      <p className="money font-bold text-ink">{d.downPct}% ({fmtUsd(t.down)})</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Interest Rate</p>
                      <p className="money font-bold text-ink">{d.apr}% APR</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Term / Monthly</p>
                      <p className="money font-bold text-primary">{fmtUsd(t.monthly, { cents: true })}/mo</p>
                    </div>
                  </div>

                  {detail.counterOffer?.note && (
                    <div className="rounded-xl bg-background p-3 text-xs border border-border text-muted-foreground italic">
                      "{detail.counterOffer.note}"
                    </div>
                  )}
                </div>

                {/* Pre-screened Risk Badges */}
                <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-success flex items-center gap-1.5">
                      <ShieldCheck className="size-4" /> Applicant Soft-Credit & Identity Assessment
                    </span>
                    <span className="font-bold text-success">Risk Score: 28/100 (Low Risk)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-muted-foreground text-[11px] pt-1">
                    <div>✓ Identity: Government ID verified</div>
                    <div>✓ Income: Verified via Plaid</div>
                    <div>✓ Soft-credit consent: On file</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {role === "seller" ? (
                    <>
                      <Button onClick={handleApprove} className="bg-primary hover:bg-primary/90 flex items-center gap-1.5">
                        <Check className="size-4" /> Approve application
                      </Button>
                      <Button variant="outline" onClick={() => setCounterOpen(true)} className="flex items-center gap-1.5">
                        <DollarSign className="size-4" /> Make counter-offer
                      </Button>
                    </>
                  ) : (
                    <>
                      {detail.counterOffer?.proposedBy === "seller" ? (
                        <>
                          <Button onClick={handleAcceptCounter} className="bg-primary hover:bg-primary/90 flex items-center gap-1.5">
                            <Check className="size-4" /> Accept seller's terms
                          </Button>
                          <Button variant="outline" onClick={() => setCounterOpen(true)}>
                            Counter back
                          </Button>
                        </>
                      ) : (
                        <div className="rounded-xl bg-surface p-4 text-xs text-muted-foreground border border-border flex items-center justify-between w-full">
                          <span>Your application is in review by Maria. Switch to Seller to approve or counter.</span>
                          <Button size="sm" onClick={() => navigate({ to: "/deals/$id", params: { id: d.id }, search: { as: "seller" } })}>
                            Switch to Maria
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 5: INSPECTION */}
            {d.stage === "inspection" && (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Wrench className="size-5 text-primary" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-ink">SafeDrive Mobile Inspection Report</h3>
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                            Simulated Partner
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Certified Mechanic #AZ-4821 · Checked Today</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> Passed (Condition 9.2/10)
                    </span>
                  </div>

                  <div className="space-y-2 text-xs pt-1">
                    {(detail.inspection?.items || []).map((item) => (
                      <div key={item.name} className="flex items-start justify-between rounded-lg bg-background p-2.5 border border-border/60">
                        <div>
                          <p className="font-semibold text-ink">{item.name}</p>
                          <p className="text-muted-foreground text-[11px] mt-0.5">{item.note}</p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0 uppercase",
                            item.status === "pass"
                              ? "bg-success/10 text-success"
                              : item.status === "good"
                                ? "bg-primary/10 text-primary"
                                : "bg-warning/10 text-warning"
                          )}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {role === "buyer" ? (
                    <Button onClick={handleAcceptInspection} className="flex items-center gap-1.5">
                      <Check className="size-4" /> Review & accept inspection (Proceed to Contract)
                    </Button>
                  ) : (
                    <div className="rounded-xl bg-surface p-4 text-xs text-muted-foreground border border-border w-full flex items-center justify-between">
                      <span>Inspection passed (9.2/10). Waiting for buyer ({d.buyer}) to review and accept...</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate({ to: "/deals/$id", params: { id: d.id }, search: { as: "buyer" } })}
                      >
                        Switch to Daniel to accept
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 6: CONTRACT */}
            {d.stage === "contract" && (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <FileSignature className="size-5 text-primary" />
                      <div>
                        <h3 className="font-bold text-ink">OwnerFi Seller Financing Agreement</h3>
                        <p className="text-xs text-muted-foreground">
                          Agreement #{detail.contract?.agreementNumber || `OF-AZ-2026-${d.id.slice(-4)}`} · State of Arizona
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Ready for Signature
                    </span>
                  </div>

                  <div className="rounded-xl bg-background p-4 border border-border text-xs space-y-2 text-muted-foreground">
                    <p className="font-semibold text-ink">Key Financing Provisions:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Principal financed: <strong>{fmtUsd(t.financed)}</strong> at <strong>{d.apr}% APR</strong> over <strong>{d.term} monthly payments</strong>.</li>
                      <li>Monthly installment: <strong>{fmtUsd(t.monthly, { cents: true })}</strong> due on the 5th of each month.</li>
                      <li>Title retention: Seller remains recorded lienholder until loan principal is paid in full.</li>
                      <li>No prepayment penalties. Buyer may payoff principal at any time without fee.</li>
                    </ul>
                  </div>

                  {/* Signatures status box */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="rounded-xl border p-3 bg-background">
                      <p className="text-muted-foreground">Seller Signature</p>
                      <p className="font-bold text-ink mt-1 flex items-center gap-1">
                        <CheckCircle2 className="size-4 text-success" />
                        {d.seller}
                      </p>
                      <p className="text-[11px] text-success mt-0.5">Signed {detail.contract?.sellerSignedAt || "Oct 4, 2026"}</p>
                    </div>

                    <div className="rounded-xl border p-3 bg-background">
                      <p className="text-muted-foreground">Buyer Signature</p>
                      <p className="font-bold text-ink mt-1 flex items-center gap-1">
                        {detail.contract?.buyerSigned ? (
                          <>
                            <CheckCircle2 className="size-4 text-success" />
                            {d.buyer}
                          </>
                        ) : (
                          <span className="text-warning">Signature Pending</span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {detail.contract?.buyerSigned ? "Signed Today" : "Awaiting Daniel's signature"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {!detail.contract?.buyerSigned ? (
                    role === "buyer" ? (
                      <Button onClick={handleSign} className="flex items-center gap-1.5">
                        <FileSignature className="size-4" /> E-sign OwnerFi Agreement (Daniel Park)
                      </Button>
                    ) : (
                      <div className="rounded-xl bg-surface p-4 text-xs text-muted-foreground border border-border w-full flex items-center justify-between">
                        <span>Seller signature already on file ✓. Waiting for Daniel Park to e-sign agreement...</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate({ to: "/deals/$id", params: { id: d.id }, search: { as: "buyer" } })}
                        >
                          Switch to Daniel to sign
                        </Button>
                      </div>
                    )
                  ) : (
                    role === "buyer" ? (
                      <Button onClick={() => payDownPayment(d.id)} className="flex items-center gap-1.5">
                        <CreditCard className="size-4" /> Both signed! Proceed to Down Payment
                      </Button>
                    ) : (
                      <div className="rounded-xl bg-surface p-4 text-xs text-muted-foreground border border-border w-full flex items-center justify-between">
                        <span>Agreement fully executed! Waiting for Daniel to submit down payment escrow...</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate({ to: "/deals/$id", params: { id: d.id }, search: { as: "buyer" } })}
                        >
                          Switch to Daniel to pay
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* STAGE 7: DOWN PAYMENT */}
            {d.stage === "down_payment" && (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">Down Payment Escrow</span>
                    <span className="text-xs font-semibold text-success flex items-center gap-1">
                      <ShieldCheck className="size-4" /> Simulated Escrow (POC)
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-primary/10 pt-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Down payment due from buyer:</span>
                      <span className="money text-2xl font-bold text-ink">{fmtUsd(t.down)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">OwnerFi software fee (seller pays):</span>
                      <span className="money font-semibold text-muted-foreground">−{fmtUsd(t.fee)}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-primary/10">
                      <span className="font-semibold text-ink">Net seller proceeds at closing:</span>
                      <span className="money font-bold text-success text-base">{fmtUsd(t.sellerNet)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {role === "buyer" ? (
                    <Button
                      onClick={handlePayDownPayment}
                      disabled={isProcessingPayment}
                      size="lg"
                      className="flex items-center gap-2"
                    >
                      {isProcessingPayment ? (
                        <>
                          <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                          Processing bank transfer...
                        </>
                      ) : (
                        <>
                          <CreditCard className="size-4" /> Simulate Pay {fmtUsd(t.down)} Down Payment
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="rounded-xl bg-surface p-4 text-xs text-muted-foreground border border-border w-full flex items-center justify-between">
                      <span>Waiting for Daniel to submit down payment escrow ({fmtUsd(t.down)})...</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate({ to: "/deals/$id", params: { id: d.id }, search: { as: "buyer" } })}
                      >
                        Switch to Daniel to pay
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 8: CLOSING */}
            {d.stage === "closing" && (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-bold text-ink flex items-center gap-2">
                      <KeyRound className="size-5 text-primary" /> Vehicle Handover & DMV Checklist
                    </h3>
                    <span className="text-xs font-semibold text-primary">Final Step</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center gap-2.5 rounded-xl bg-background p-3 border border-border">
                      <CheckCircle2 className="size-5 text-success shrink-0" />
                      <div>
                        <p className="font-semibold text-ink">Down payment received ({fmtUsd(t.down)})</p>
                        <p className="text-[11px] text-muted-foreground">Funds cleared into seller's payout account</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-xl bg-background p-3 border border-border">
                      <CheckCircle2 className="size-5 text-success shrink-0" />
                      <div>
                        <p className="font-semibold text-ink">OwnerFi lien recorded with DMV</p>
                        <p className="text-[11px] text-muted-foreground">Electronic title recorded with Maria Alvarez as lienholder · <span className="italic">Simulated DMV e-Title</span></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-xl bg-background p-3 border border-border">
                      <KeyRound className="size-5 text-primary shrink-0" />
                      <div>
                        <p className="font-semibold text-ink">Physical vehicle & key handover</p>
                        <p className="text-[11px] text-muted-foreground">Meet buyer, hand over keys, and verify vehicle odometer</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {role === "seller" ? (
                    <Button onClick={handleConfirmClosing} size="lg" className="flex items-center gap-2">
                      <Handshake className="size-4" /> Confirm Vehicle Handover (Complete Closing)
                    </Button>
                  ) : (
                    <div className="rounded-xl bg-surface p-4 text-xs text-muted-foreground border border-border w-full flex items-center justify-between">
                      <span>Down payment held in escrow. Waiting for seller Maria to hand over keys & complete closing...</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate({ to: "/deals/$id", params: { id: d.id }, search: { as: "seller" } })}
                      >
                        Switch to Maria to handover
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 9: ACTIVE */}
            {d.stage === "active" && (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-success/30 bg-success/5 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-success">Loan Status</span>
                      <h3 className="text-xl font-bold text-ink mt-0.5">Active Seller Financing</h3>
                    </div>
                    <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> Good Standing
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-success/15 pt-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Monthly Payment</p>
                      <p className="money text-lg font-bold text-ink mt-0.5">{fmtUsd(t.monthly, { cents: true })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Installments</p>
                      <p className="font-bold text-ink mt-0.5">
                        {detail.installment?.paidCount ?? 0} of {detail.installment?.totalCount || d.term} paid
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Next Due Date</p>
                      <p className="font-bold text-ink mt-0.5">{detail.installment?.nextDueDate || "Nov 5, 2026"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Financed</p>
                      <p className="money font-bold text-ink mt-0.5">{fmtUsd(t.financed)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {role === "buyer" ? (
                    <Button onClick={handlePayInstallment} className="flex items-center gap-2">
                      <DollarSign className="size-4" /> Simulate Make Monthly Installment Payment ({fmtUsd(t.monthly, { cents: true })})
                    </Button>
                  ) : (
                    <div className="rounded-xl bg-surface p-4 text-xs text-muted-foreground border border-border w-full">
                      <p className="font-semibold text-ink">Seller Servicing Overview</p>
                      <p className="mt-1">
                        Monthly installments of {fmtUsd(t.monthly, { cents: true })} are automatically debited from buyer and direct-deposited to your linked bank account.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 10: PAID OFF */}
            {d.stage === "paid_off" && (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-success/30 bg-success/5 p-6 text-center space-y-2">
                  <CheckCircle2 className="mx-auto size-12 text-success" />
                  <h3 className="text-xl font-bold text-ink">Loan Paid Off in Full!</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    All {d.term} installments satisfied. Official DMV Lien Release Certificate issued.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Deal Activity & Negotiation History Feed */}
          <section className="card-surface p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-ink flex items-center gap-2 text-base">
              <MessageSquare className="size-4 text-primary" /> Deal Messages & Negotiation Log
            </h3>

            {detail.messages && detail.messages.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {detail.messages.map((m) => {
                  const isMe = m.sender === role;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-xl p-3 text-xs leading-relaxed max-w-[85%]",
                        isMe
                          ? "ml-auto bg-primary text-primary-foreground shadow-sm"
                          : "bg-surface text-ink border border-border"
                      )}
                    >
                      <div className="flex justify-between items-center gap-3 mb-1 opacity-80 text-[11px] font-semibold">
                        <span>{m.senderName} ({m.sender})</span>
                        <span>{m.time}</span>
                      </div>
                      <p>{m.text}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No chat messages yet in this deal.</p>
            )}

            {/* Send chat message input */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Input
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendChat();
                }}
                placeholder={`Type a note or question as ${role === "seller" ? "Maria" : "Daniel"}...`}
                className="text-xs"
              />
              <Button onClick={handleSendChat} size="sm" className="shrink-0 flex items-center gap-1">
                <Send className="size-3.5" /> Send
              </Button>
            </div>
          </section>
        </div>

        {/* Right Column: "Who Goes Next" + Financial Breakdown */}
        <aside className="space-y-5">
          {/* Who Goes Next Card */}
          <div className="rounded-2xl bg-ink p-6 text-primary-foreground shadow-sm space-y-2">
            <p className="text-xs uppercase tracking-wider opacity-60 font-semibold">Who goes next</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              {nextInfo.who === "you" ? (
                <>
                  <Sparkles className="size-5 text-warning" /> Your turn
                </>
              ) : nextInfo.who === "other" ? (
                `Waiting for ${role === "seller" ? "Buyer (Daniel)" : "Seller (Maria)"}`
              ) : (
                "Completed"
              )}
            </p>
            <p className="text-xs opacity-80 leading-relaxed pt-1">{nextInfo.text}</p>
          </div>

          {/* Money Summary Card */}
          <div className="card-surface p-5 text-sm shadow-sm">
            <h3 className="mb-3 font-semibold text-ink">Financial Breakdown</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Vehicle sales price</span>
                <span className="money font-semibold text-ink">{fmtUsd(d.priceCents)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Down payment ({d.downPct}%)</span>
                <span className="money font-semibold text-ink">{fmtUsd(t.down)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Amount financed</span>
                <span className="money font-semibold text-ink">{fmtUsd(t.financed)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Interest rate (APR)</span>
                <span className="font-semibold text-ink">{d.apr}%</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Term length</span>
                <span className="font-semibold text-ink">{d.term} months</span>
              </div>
              <div className="flex justify-between py-1 border-t border-border pt-2">
                <span className="font-semibold text-ink">Monthly installment</span>
                <span className="money font-bold text-primary text-sm">{fmtUsd(t.monthly, { cents: true })}/mo</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Total interest earned by seller</span>
                <span className="money font-semibold text-success">+{fmtUsd(t.interest)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">OwnerFi software fee (seller pays)</span>
                <span className="money text-muted-foreground">−{fmtUsd(t.fee)}</span>
              </div>
              <div className="flex justify-between py-1 border-t border-border pt-2">
                <span className="font-bold text-ink">Seller net proceeds</span>
                <span className="money font-bold text-ink">{fmtUsd(t.sellerTotal)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* COUNTER-OFFER DIALOG */}
      <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Make Counter-Offer</DialogTitle>
            <DialogDescription>
              Propose updated financing terms for {d.car}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-ink">Price ($)</label>
              <Input
                type="number"
                value={counterPriceDollars}
                onChange={(e) => setCounterPriceDollars(Number(e.target.value))}
                step={250}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between font-semibold text-ink">
                <span>Down payment</span>
                <span className="money">{counterDownPct}% · {fmtUsd(counterCalc.down)}</span>
              </div>
              <Slider
                value={[counterDownPct]}
                min={10}
                max={40}
                step={1}
                onValueChange={(val) => setCounterDownPct(val[0] ?? 15)}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between font-semibold text-ink">
                <span>Interest Rate</span>
                <span>{counterApr}% APR</span>
              </div>
              <Slider
                value={[counterApr]}
                min={6}
                max={10}
                step={0.5}
                onValueChange={(val) => setCounterApr(val[0] ?? 9)}
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-ink">Note to other party</label>
              <Input value={counterNote} onChange={(e) => setCounterNote(e.target.value)} />
            </div>

            <div className="rounded-xl bg-primary/5 p-3 border border-primary/20 text-xs flex justify-between items-center">
              <span className="text-muted-foreground">New monthly payment:</span>
              <span className="money text-lg font-bold text-primary">{fmtUsd(counterCalc.monthly, { cents: true })}/mo</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setCounterOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCounterSubmit}>
              Send counter-offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function getDynamicNextAction(
  d: DemoDeal,
  detail: DealDetailData,
  role: Role
): { who: "you" | "other" | "none"; text: string } {
  const stage = d.stage;

  if (stage === "inquiry") {
    if (role === "seller") return { who: "you", text: "Reply to Daniel's question or invite him to a test drive." };
    return { who: "other", text: "Waiting for Maria to answer your message." };
  }

  if (stage === "test_drive") {
    if (detail.testDrive?.status !== "confirmed") {
      if (role === "seller") return { who: "you", text: "Confirm test drive time slot." };
      return { who: "other", text: "Waiting for Maria to confirm your test drive time." };
    }
    return { who: "you", text: "Complete test drive to proceed to application." };
  }

  if (stage === "application" || stage === "negotiation") {
    const isSellerCounter = detail.counterOffer?.proposedBy === "seller";
    if (isSellerCounter) {
      if (role === "buyer") return { who: "you", text: "Review Maria's counter-offer and accept or counter." };
      return { who: "other", text: "Waiting for Daniel to review your counter-offer." };
    } else {
      if (role === "seller") return { who: "you", text: "Review Daniel's offer: approve or make counter-offer." };
      return { who: "other", text: "Waiting for Maria to approve or counter your offer." };
    }
  }

  if (stage === "inspection") {
    if (role === "buyer") return { who: "you", text: "Review the SafeDrive mechanic inspection report and accept." };
    return { who: "other", text: "Waiting for Daniel to review inspection report." };
  }

  if (stage === "contract") {
    if (!detail.contract?.buyerSigned) {
      if (role === "buyer") return { who: "you", text: "E-sign the OwnerFi Seller Financing Agreement." };
      return { who: "other", text: "Waiting for Daniel to e-sign agreement." };
    }
    return { who: "you", text: "Both parties signed! Proceed to down payment." };
  }

  if (stage === "down_payment") {
    if (role === "buyer") return { who: "you", text: "Submit down payment to initiate closing." };
    return { who: "other", text: "Waiting for Daniel to pay down payment." };
  }

  if (stage === "closing") {
    if (role === "seller") return { who: "you", text: "Confirm vehicle handover and title recording." };
    return { who: "other", text: "Waiting for vehicle handoff confirmation." };
  }

  if (stage === "active") {
    if (role === "buyer") return { who: "you", text: "Pay monthly installment." };
    return { who: "other", text: "Loan is active. Next installment scheduled on time." };
  }

  return { who: "none", text: "Deal complete." };
}
