import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Car as CarIcon,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Download,
  Handshake,
  Heart,
  Megaphone,
  MessageSquare,
  Pencil,
  Pause,
  ExternalLink,
} from "lucide-react";
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
  EmptyState,
  Modal,
  Popover,
  Skeleton,
  Slider,
  TextInput,
  buttonClasses,
  useToast,
} from "@/components/kit";
import { CarImage, carEstimate, carFullTitle } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { getNextAction } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { dealTerms, rateCapForState } from "@/lib/finance";
import { money, moneyC, percent } from "@/lib/format";
import { useAds } from "@/lib/ads";
import { CHANNELS } from "@/lib/ads";
import { dealForVehicle, useSellerVehicles } from "@/lib/seller-data";
import { cn } from "@/lib/utils";
import type { PublicVehicle } from "@/lib/vehicles.functions";

export const Route = createFileRoute("/seller/vehicles/$id/")({
  head: () => ({ meta: [{ title: "Your car · OwnerFi" }] }),
  component: VehiclePage,
});

/* A section card with an anchor, title, count and optional action. */
function Section({
  id,
  title,
  description,
  count,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  count?: number | undefined;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-2xl">
      <Card className="min-w-0">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="flex items-center gap-2 font-sans text-lg font-bold leading-7 tracking-normal">
              {title}
              {count !== undefined && (
                <span className="num rounded-full bg-ink/[0.07] px-2 font-sans text-xs font-semibold leading-5 text-ink/70">
                  {count}
                </span>
              )}
            </h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </div>
        {children}
      </Card>
    </section>
  );
}

const TERM_CHOICES = [24, 36, 48, 60];

function EditTerms({ vehicle: v, onClose }: { vehicle: PublicVehicle; onClose: () => void }) {
  const toast = useToast();
  const { updateVehicle } = useDemoStore();
  const cap = rateCapForState(v.state);
  const [price, setPrice] = useState(String(v.price_cents / 100));
  const [down, setDown] = useState(Number(v.min_down_pct));
  const [apr, setApr] = useState(Math.min(Number(v.apr), cap));
  const [terms, setTerms] = useState<number[]>(v.allowed_terms);
  const p = Number(price);
  const ok = p >= 1000 && terms.length > 0;
  const example = ok
    ? dealTerms({ priceCents: p * 100, downPct: down, apr, termMonths: Math.max(...terms) }).monthly / 100
    : 0;
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit your terms"
      description="Buyers who already made an offer keep the terms they saw."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ok}
            onClick={() => {
              updateVehicle(v.id, { price_cents: p * 100, min_down_pct: down, apr, allowed_terms: terms });
              toast({ tone: "success", title: "Terms updated", description: "New buyers see these terms." });
              onClose();
            }}
          >
            Save terms
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextInput
          label="Asking price"
          inputMode="numeric"
          leftAdornment="$"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
          error={p < 1000 ? "Enter a price of $1,000 or more." : undefined}
        />
        <div>
          <p className="mb-1 text-sm font-semibold">Minimum down payment</p>
          <Slider label="Minimum down payment" min={10} max={30} value={down} onChange={setDown} formatValue={(x) => `${x}%`} />
          <p className="num mt-1 text-sm text-muted">{money(Math.round((p || 0) * down) / 100)} on this price.</p>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold">Interest rate</p>
          <Slider
            label="Interest rate"
            min={4}
            max={cap}
            step={0.5}
            value={apr}
            onChange={setApr}
            formatValue={percent}
            marker={{ value: cap, label: "State max" }}
          />
          <p className="mt-1 text-sm text-muted">Your state allows up to {percent(cap)}.</p>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Term lengths</legend>
          <div className="flex flex-wrap gap-4">
            {TERM_CHOICES.map((t) => (
              <Checkbox
                key={t}
                label={`${t} months`}
                checked={terms.includes(t)}
                onChange={() => setTerms((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].sort((a, b) => a - b)))}
              />
            ))}
          </div>
        </fieldset>
        {ok && (
          <p className="num rounded-xl bg-surface p-3 text-sm">
            Example: about <strong>{money(example)}/mo</strong> with the minimum down payment.
          </p>
        )}
      </div>
    </Modal>
  );
}

function PauseRelist({ mode, vehicle: v, onClose }: { mode: "pause" | "relist"; vehicle: PublicVehicle; onClose: () => void }) {
  const toast = useToast();
  const { updateVehicle } = useDemoStore();
  const relist = mode === "relist";
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={relist ? "Relist this car?" : "Hide this car from buyers?"}
      description={
        relist
          ? "Buyers will see it in search again, and your paused ads restart."
          : "Conversations stay open and your ads pause. You can relist any time."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              updateVehicle(v.id, { status: relist ? "listed" : "delisted" });
              toast({ tone: "success", title: relist ? "Your car is live again" : "Listing paused", ...(relist ? {} : { description: "Buyers can’t see it now." }) });
              onClose();
            }}
          >
            {relist ? "Relist" : "Pause listing"}
          </Button>
        </>
      }
    >
      <span />
    </Modal>
  );
}

function StatusBanner({ status, dealId }: { status: string; dealId?: string | undefined }) {
  const open = dealId && (
    <ButtonLink size="sm" variant="secondary" to={`/deals/${dealId}?as=seller`}>
      Open the deal
    </ButtonLink>
  );
  switch (status) {
    case "pending_review":
      return (
        <Alert tone="warning" title="We’re checking the title">
          The title has a brand, so our team takes a quick look. This takes up to 24 hours. Your car goes live as soon as we’re done.
        </Alert>
      );
    case "reserved":
      return (
        <Alert tone="info" title="A buyer is in a deal on this car" action={open}>
          It’s hidden from search until the deal ends.
        </Alert>
      );
    case "sold_active":
      return (
        <Alert tone="success" title="Sold on payments" action={open}>
          You stay on the title until it’s paid off.
        </Alert>
      );
    case "paid_off":
      return (
        <Alert tone="success" title="Paid off" action={open}>
          Request your lien release in the deal.
        </Alert>
      );
    case "delisted":
      return (
        <Alert tone="info" title="Buyers can’t see this car">
          Relist it any time. Your conversations stay open.
        </Alert>
      );
    default:
      return null;
  }
}

function VehiclePage() {
  const { id } = Route.useParams();
  const toast = useToast();
  const { vehicles, loading } = useSellerVehicles();
  const { deals, getDealDetail } = useDemoStore();
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"pause" | "relist" | null>(null);
  const [photo, setPhoto] = useState(0);
  const ads = useAds(id);

  const found = vehicles.find((x) => x.vehicle.id === id);
  if (loading && !found) {
    return (
      <div aria-busy="true" className="mx-auto max-w-6xl space-y-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (!found) {
    return (
      <EmptyState
        headingLevel={1}
        icon={<CarIcon aria-hidden className="h-6 w-6" />}
        title="We can’t find that car"
        description="It may have been removed, or it isn’t yours."
        action={<ButtonLink to="/seller/vehicles">Back to my cars</ButtonLink>}
      />
    );
  }

  const { vehicle: v, status, views, saves, questions } = found;
  const vDeals = dealForVehicle(v, deals);
  const active = vDeals.find((d) => d.stage !== "declined" && d.stage !== "cancelled");
  const editable = status === "listed" || status === "delisted";
  const { monthly } = carEstimate(v);
  const photos = v.photos.length ? v.photos : [""];
  const minDown = Math.round((v.price_cents / 100) * Number(v.min_down_pct)) / 100;
  const t = dealTerms({
    priceCents: v.price_cents,
    downPct: Number(v.min_down_pct),
    apr: Number(v.apr),
    termMonths: v.allowed_terms.includes(48) ? 48 : Math.max(...v.allowed_terms),
  });

  const menu: { label: string; icon: ReactNode; run: () => void }[] = [];
  if (editable) menu.push({ label: "Edit terms", icon: <Pencil aria-hidden className="h-4 w-4" />, run: () => setEditing(true) });
  if (status === "listed") menu.push({ label: "Pause listing", icon: <Pause aria-hidden className="h-4 w-4" />, run: () => setMode("pause") });

  const stats = [
    { icon: Eye, n: views, label: "views" },
    { icon: Heart, n: saves, label: "saves" },
    { icon: MessageSquare, n: questions, label: questions === 1 ? "question" : "questions" },
    { icon: Handshake, n: vDeals.length, label: vDeals.length === 1 ? "offer" : "offers" },
  ];
  const facts = [
    { label: "Asking price", value: moneyC(v.price_cents) },
    { label: "Smallest down payment", value: `${v.min_down_pct}%` },
    { label: "Interest rate", value: percent(Number(v.apr)) },
    { label: "Longest term", value: `${Math.max(...v.allowed_terms)} mo` },
    { label: "Example monthly", value: money(monthly), strong: true },
  ];

  const checks: [string, string][] = [
    ["Lien-free title", "pass"],
    ["Stolen-vehicle check", "pass"],
    ["Branded-title check", status === "pending_review" ? "review" : "pass"],
    ["History report", "pass"],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-3">
        <AppLink to="/seller/vehicles" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" /> My cars
        </AppLink>
        <Card padding="none">
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
            <CarImage src={v.photos[0]} alt="" make={v.make} model={v.model} className="h-24 w-32 shrink-0 !rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold md:text-[28px]">{carFullTitle(v)}</h1>
                <StatusChip kind="vehicle" value={status} />
              </div>
              <p className="num mt-1.5 text-sm text-muted">
                {v.city}, {v.state}
              </p>
              <ul className="num mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {stats.map(({ icon: Icon, n, label }) => (
                  <li key={label} className="inline-flex items-center gap-1.5">
                    <Icon aria-hidden className="h-4 w-4" />
                    <span className="font-semibold text-ink">{n}</span> {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2 md:shrink-0 md:self-start">
              {status === "listed" && (
                <ButtonLink to={`/cars/${v.id}`} leftIcon={<ExternalLink aria-hidden className="h-4 w-4" />}>
                  View public listing
                </ButtonLink>
              )}
              {status === "delisted" && <Button onClick={() => setMode("relist")}>Relist this car</Button>}
              {menu.length > 0 && (
                <Popover
                  align="right"
                  className="w-52 p-1.5"
                  trigger={({ props, toggle }) => (
                    <button type="button" onClick={toggle} {...props} className={buttonClasses("secondary", "md", false, "gap-1")}>
                      More <ChevronDown aria-hidden className="h-4 w-4" />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <>
                      {menu.map((m) => (
                        <button
                          key={m.label}
                          type="button"
                          onClick={() => {
                            close();
                            m.run();
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-ink/5"
                        >
                          {m.icon}
                          {m.label}
                        </button>
                      ))}
                    </>
                  )}
                </Popover>
              )}
            </div>
          </div>
          <div className="border-t border-ink/[0.08] bg-surface/60 px-5 py-4 md:px-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-0 sm:divide-x sm:divide-ink/10">
              {facts.map((f) => (
                <div key={f.label} className="min-w-0 sm:px-5 sm:first:pl-0">
                  <dt className="text-xs font-medium text-muted">{f.label}</dt>
                  <dd className={cn("num mt-0.5 font-display text-lg font-bold leading-7", f.strong && "text-primary")}>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </header>

      <StatusBanner status={status} dealId={active?.id} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Section id="vehicle-photos" title="Photos" count={v.photos.length}>
            <CarImage src={photos[photo] || undefined} alt={carFullTitle(v)} make={v.make} model={v.model} aspect="16/9" />
            {photos.length > 1 && (
              <ul className="mt-3 flex gap-2 overflow-x-auto p-0.5">
                {photos.map((p, i) => (
                  <li key={i} className="w-20 shrink-0">
                    <button
                      type="button"
                      aria-label={`Show photo ${i + 1}`}
                      aria-current={i === photo}
                      onClick={() => setPhoto(i)}
                      className={cn("block w-full rounded-xl", i === photo && "ring-2 ring-primary")}
                    >
                      <CarImage src={p || undefined} alt="" className="rounded-xl" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            id="vehicle-terms"
            title="Your terms"
            description="Buyers see these on your listing."
            action={
              editable && (
                <Button variant="secondary" size="sm" leftIcon={<Pencil aria-hidden className="h-4 w-4" />} onClick={() => setEditing(true)}>
                  Edit terms
                </Button>
              )
            }
          >
            <Breakdown
              rows={[
                { label: "Asking price", value: moneyC(v.price_cents) },
                { label: "Minimum down payment", value: `${v.min_down_pct}% (${money(minDown)})` },
                { label: "Interest rate", value: percent(Number(v.apr)), hint: `${v.state} allows up to ${percent(rateCapForState(v.state))}.` },
                { label: "Term lengths", value: v.allowed_terms.map((m) => `${m} mo`).join(", ") },
                { label: "Example monthly payment", value: `${money(monthly)}/mo` },
              ]}
            />
          </Section>

          <Section
            id="vehicle-inquiries"
            title="Questions from buyers"
            description="Reply in your inbox. Quick answers sell cars faster."
            count={questions}
          >
            {vDeals.length === 0 ? (
              <EmptyState
                icon={<MessageSquare aria-hidden className="h-6 w-6" />}
                title="No questions yet"
                description="Ads bring buyers faster."
                action={
                  <AppLink to={`/seller/vehicles/${v.id}#vehicle-ads`} className="font-semibold text-primary underline">
                    See your ads
                  </AppLink>
                }
              />
            ) : (
              <ul className="-my-1 space-y-1">
                {vDeals.map((d) => {
                  const last = getDealDetail(d.id).messages.at(-1);
                  return (
                    <li key={d.id}>
                      <AppLink
                        to="/seller/inbox"
                        className="-mx-3 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface"
                      >
                        <Avatar name={d.buyer} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{d.buyer.split(" ")[0]}</span>
                          <span className="block truncate text-sm text-muted">{last?.text ?? "No messages yet"}</span>
                        </span>
                        {last && <span className="shrink-0 text-sm text-muted">{last.time}</span>}
                        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                      </AppLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section
            id="vehicle-deals"
            title="Offers and deals"
            description="Each buyer who made an offer, and what happens next."
            count={vDeals.length}
          >
            {vDeals.length === 0 ? (
              <EmptyState
                icon={<Handshake aria-hidden className="h-6 w-6" />}
                title="No offers yet"
                description="When a buyer makes an offer, it shows up here."
              />
            ) : (
              <ul className="-my-1 space-y-1">
                {vDeals.map((d) => (
                  <li key={d.id}>
                    <AppLink
                      to={`/deals/${d.id}?as=seller`}
                      className="-mx-3 flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface"
                    >
                      <Avatar name={d.buyer} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{d.buyer.split(" ")[0]}</span>
                        <span className="block truncate text-sm text-muted">{getNextAction(d, "seller").text}</span>
                      </span>
                      <StatusChip kind="deal" value={d.stage} />
                      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                    </AppLink>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            id="vehicle-ads"
            title="Ads"
            description="Car sites and links that send buyers to this car."
            count={ads.length}
            action={
              (status === "listed" || ads.length > 0) && ads.length > 0 ? (
                <ButtonLink size="sm" to={`/seller/vehicles/${v.id}/advertise`}>
                  Manage ads
                </ButtonLink>
              ) : null
            }
          >
            {status !== "listed" && <Alert tone="info" className="mb-4">Publish your car first. Then you can advertise it.</Alert>}
            {ads.length === 0 ? (
              <EmptyState
                icon={<Megaphone aria-hidden className="h-6 w-6" />}
                title="Not advertised yet"
                description="Post to car sites and get a link you can share anywhere."
                action={
                  status === "listed" ? <ButtonLink size="sm" to={`/seller/vehicles/${v.id}/advertise`}>Advertise everywhere</ButtonLink> : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-ink/10">
                {ads.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-semibold">{CHANNELS.find((c) => c.id === a.channelId)?.name ?? a.channelId}</p>
                      <p className="num text-sm text-muted">
                        {a.impressions} views · {a.clicks} clicks · {a.inquiries} questions
                      </p>
                    </div>
                    <StatusChip kind="adChannel" value={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside aria-label="At a glance" className="min-w-0 space-y-5 xl:sticky xl:top-24">
          <Card>
            <CardHeader title="If a buyer pays the smallest down payment" description={`${t.schedule.length} months at ${percent(Number(v.apr))}`} />
            <Breakdown
              rows={[
                { label: "Down payment", value: moneyC(t.down) },
                { label: "OwnerFi fee", hint: "10% of the down payment", value: `−${moneyC(t.fee)}`, tone: "negative" },
                { label: "You receive at closing", value: moneyC(t.sellerNet) },
                { label: "Monthly payment", value: moneyC(t.monthly), hint: "Paid straight to you." },
                { label: "Interest you earn", value: moneyC(t.interest) },
              ]}
              total={{ label: "Total proceeds", value: moneyC(t.sellerTotal) }}
            />
          </Card>
          <Card>
            <CardHeader title="Safety checks" />
            <ul className="divide-y divide-ink/10">
              {checks.map(([label, value]) => (
                <li key={label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <span className="text-sm">{label}</span>
                  <StatusChip kind="check" value={value} />
                </li>
              ))}
            </ul>
          </Card>
          <Card id="vehicle-documents">
            <CardHeader title="Documents" />
            <ul className="divide-y divide-ink/10">
              {[
                { name: "Title (copy)", note: `VIN on file` },
                { name: "Vehicle history report", note: "Checked by OwnerFi" },
              ].map((d) => (
                <li key={d.name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <FileText aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{d.name}</span>
                    <span className="block truncate text-sm text-muted">{d.note}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Download ${d.name}`}
                    leftIcon={<Download aria-hidden className="h-4 w-4" />}
                    onClick={() => toast({ tone: "info", title: "Download started (demo)" })}
                  >
                    Download
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      {editing && <EditTerms vehicle={v} onClose={() => setEditing(false)} />}
      {mode && <PauseRelist mode={mode} vehicle={v} onClose={() => setMode(null)} />}
    </div>
  );
}
