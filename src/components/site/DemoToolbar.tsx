import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronUp, FastForward, FlaskConical, Play, RotateCcw } from "lucide-react";
import { Button, NativeSelect, Switch, Tooltip, useToast } from "@/components/kit";
import { useAuth } from "@/lib/auth-store";
import { resetAutopay } from "@/lib/autopay";
import { PERSONAS, STAGE_LABEL, type DemoDeal, type Role, type Stage } from "@/lib/demo-data";
import { format } from "date-fns/format";
import { demoNow } from "@/lib/demo-clock";
import { useDemoStore } from "@/lib/demo-store";
import { PORTAL } from "@/lib/portal";
import { auth, demoFlags, resetSession, useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const PERSONAS_LIST: { role: Role | null; label: string }[] = [
  { role: "seller", label: "Seller Maria" },
  { role: "buyer", label: "Buyer Daniel" },
  { role: "admin", label: "Admin Sam" },
  { role: null, label: "Signed out" },
];

const HIDE_KEY = "ownerfi-demo-hidden";
const POS_KEY = "ownerfi-demo-toolbar-pos";

type Store = ReturnType<typeof useDemoStore>;

/** What "Advance" does for a deal in each stage: the same actions the Deal Room buttons call. */
const ADVANCE: Partial<Record<Stage, { label: string; run: (s: Store, d: DemoDeal) => void }>> = {
  inquiry: { label: "Seller confirms the test drive", run: (s, d) => s.confirmTestDrive(d.id) },
  test_drive: { label: "Test drive is completed", run: (s, d) => s.completeTestDrive(d.id) },
  application: { label: "Seller accepts the offer", run: (s, d) => s.approveOffer(d.id) },
  negotiation: { label: "Both sides agree the terms", run: (s, d) => s.acceptCounterOffer(d.id) },
  inspection: { label: "Inspection is accepted", run: (s, d) => s.acceptInspection(d.id) },
  contract: {
    label: "Both sides sign",
    run: (s, d) => {
      s.signContract(d.id, "seller");
      s.signContract(d.id, "buyer");
    },
  },
  down_payment: { label: "Buyer pays the down payment", run: (s, d) => s.payDownPayment(d.id) },
  closing: { label: "Title moves at the DMV", run: (s, d) => s.confirmClosing(d.id) },
  active: { label: "Buyer pays this month", run: (s, d) => s.payInstallment(d.id) },
};

const OPEN_STAGES = new Set<Stage>(Object.keys(ADVANCE) as Stage[]);

export function DemoToolbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const store = useDemoStore();
  const toast = useToast();
  const { demo } = useSession();
  const current = user?.role ?? null;
  const name = user ? `${PORTAL[user.role].label} ${PORTAL[user.role].first}` : null;
  const [open, setOpen] = useState(false);
  const [dealId, setDealId] = useState("");
  const [hidden, setHidden] = useState(false);
  // Where the person dragged the button to (top-left corner, in pixels). Null means the default corner.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  // ?demo=0 hides the toolbar for the rest of the visit (?demo=1 brings it back). ?fail=payment makes the next payment fail.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("demo") === "0") sessionStorage.setItem(HIDE_KEY, "1");
      if (q.get("demo") === "1") sessionStorage.removeItem(HIDE_KEY);
      setHidden(sessionStorage.getItem(HIDE_KEY) === "1");
      if (q.get("fail") === "payment") demoFlags.set({ payFails: true });
      const saved = localStorage.getItem(POS_KEY);
      if (saved) setPos(JSON.parse(saved) as { x: number; y: number });
    } catch {
      /* storage blocked: the toolbar just shows */
    }
  }, []);
  if (hidden) return null;

  const mine = current
    ? store.deals.filter(
        (d) =>
          OPEN_STAGES.has(d.stage) &&
          (current === "admin" || (current === "seller" ? d.seller : d.buyer) === PERSONAS[current].name),
      )
    : [];
  const picked = mine.find((d) => d.id === dealId) ?? mine[0];
  const step = picked ? ADVANCE[picked.stage] : undefined;

  return (
    <div
      className={cn("fixed z-40 flex print:hidden", !pos && "bottom-20 left-3 lg:bottom-4 lg:left-auto lg:right-4", pos && pos.y < 360 ? "flex-col" : "flex-col-reverse")}
      {...(pos ? { style: { left: pos.x, top: pos.y } } : {})}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="demo-panel"
        aria-label={`Demo controls, ${name ?? "signed out"}. Drag to move.`}
        title="Demo controls. Drag to move out of the way."
        onClick={() => {
          // A drag ends with a click; that one shouldn't open the panel.
          if (drag.current?.moved) {
            drag.current = null;
            return;
          }
          setOpen((o) => !o);
        }}
        onPointerDown={(e) => {
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || e.buttons !== 1) return;
          if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return; // still a click
          d.moved = true;
          setPos({ x: Math.max(0, Math.min(window.innerWidth - 48, e.clientX - d.dx)), y: Math.max(0, Math.min(window.innerHeight - 48, e.clientY - d.dy)) });
        }}
        onPointerUp={() => {
          if (drag.current?.moved && pos) {
            try {
              localStorage.setItem(POS_KEY, JSON.stringify(pos));
            } catch {
              /* ignore */
            }
          } else drag.current = null;
        }}
        className={cn("flex touch-none items-center gap-2 rounded-full bg-ink text-xs font-semibold text-white shadow-raised", open ? "px-3 py-2" : "h-10 w-10 justify-center opacity-80 hover:opacity-100")}
      >
        <FlaskConical aria-hidden className="h-4 w-4" />
        {open && (
          <>
            Demo · {name ?? "Signed out"}
            <ChevronUp aria-hidden className="h-4 w-4" />
          </>
        )}
      </button>
      {open && (
        <div
          id="demo-panel"
          role="group"
          aria-label="Demo controls"
          className="mb-2 max-h-[70vh] w-72 max-w-[calc(100vw-1.5rem)] overflow-auto rounded-2xl border border-ink/10 bg-white p-4 shadow-raised"
        >
          <p className="text-sm font-semibold">Switch persona</p>
          <div className="mt-2 grid gap-1">
            {PERSONAS_LIST.map((p) => {
              const on = p.role === current;
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={on}
                  onClick={async () => {
                    // Leave the current portal first: its role guard would otherwise see the new user and send them to /no-access.
                    await navigate({ to: "/" });
                    auth.setPersona(p.role);
                    if (p.role) await navigate({ to: PORTAL[p.role].home as never });
                  }}
                  className={cn(
                    "rounded-xl px-3 py-2 text-left text-sm font-medium",
                    on ? "bg-primary text-white" : "hover:bg-ink/5",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-2 border-t border-ink/10 pt-3">
            {mine.length === 0 ? (
              <p className="text-sm text-muted">No open deals for this persona.</p>
            ) : (
              <NativeSelect
                label="Deal to move forward"
                value={picked?.id ?? ""}
                onChange={(e) => setDealId(e.target.value)}
                options={mine.map((d) => ({ value: d.id, label: `${d.car} · ${STAGE_LABEL[d.stage]}` }))}
              />
            )}
            <Tooltip content="Does the next step for this deal">
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                disabled={!step}
                leftIcon={<Play aria-hidden className="h-4 w-4" />}
                onClick={() => {
                  if (picked && step) {
                    step.run(store, picked);
                    toast({ tone: "success", title: "Moved forward", description: step.label });
                  }
                }}
              >
                {step ? `Advance: ${step.label}` : "Advance current deal"}
              </Button>
            </Tooltip>
            <div className="grid gap-1">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FastForward aria-hidden className="h-4 w-4" /> Time travel
                <span className="num ml-auto text-xs font-normal text-muted">{format(demoNow(), "MMM d, yyyy")}</span>
              </p>
              <div className="grid grid-cols-2 gap-1">
                {([[1, "+1 day"], [5, "+5 days"], [15, "+15 days"], [30, "+1 month"]] as const).map(([n, l]) => (
                  <Button
                    key={n}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      demoFlags.set({ daysAhead: (demo.daysAhead ?? 0) + n });
                      toast({ tone: "info", title: `${n} ${n === 1 ? "day" : "days"} later`, description: "Autopay and late notices run for the new date." });
                    }}
                  >
                    {l}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-ink/10 pt-3">
            <div className="grid gap-2 border-t border-ink/10 pt-3">
              <p className="text-sm font-semibold">Make it fail</p>
              <Switch checked={demo.payFails} onChange={(v) => demoFlags.set({ payFails: v })} label="Next payment fails" />
              <Switch checked={demo.reqFails} onChange={(v) => demoFlags.set({ reqFails: v })} label="Next request fails" />
              <Button
                variant="ghost"
                size="sm"
                disabled={!picked}
                onClick={() => {
                  if (!picked) return;
                  const r = store.replayPaymentWebhook(picked.id);
                  toast({ tone: "info", title: r.duplicate ? "Webhook replayed: ignored, nothing changed." : "Webhook applied." });
                }}
              >
                Replay last payment webhook
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 border-t border-ink/10 pt-3">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw aria-hidden className="h-4 w-4" />}
              onClick={() => {
                store.resetDemo();
                resetAutopay();
                resetSession();
                setOpen(false);
                navigate({ to: "/" });
              }}
            >
              Reset demo data
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
