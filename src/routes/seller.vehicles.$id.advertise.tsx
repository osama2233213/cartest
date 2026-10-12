import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Megaphone, MoreHorizontal, Share2 } from "lucide-react";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  Popover,
  Skeleton,
  TextArea,
  TextInput,
  useToast,
} from "@/components/kit";
import { CarImage, carFullTitle } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { CHANNELS, clipText, postAds, removeAd, retryAd, setAdStatus, useAds, type Channel } from "@/lib/ads";
import { moneyC } from "@/lib/format";
import { useSellerVehicles } from "@/lib/seller-data";
import { cn } from "@/lib/utils";
import type { PublicVehicle } from "@/lib/vehicles.functions";

export const Route = createFileRoute("/seller/vehicles/$id/advertise")({
  head: () => ({ meta: [{ title: "Advertise · OwnerFi" }] }),
  component: AdvertisePage,
});

const suggestTitle = (v: PublicVehicle) =>
  `${carFullTitle(v)} · Pay monthly, no bank · from ${moneyC(Math.round((v.price_cents * Number(v.min_down_pct)) / 100))} down`;
const suggestText = (v: PublicVehicle) =>
  [
    `${carFullTitle(v)} with ${v.mileage.toLocaleString("en-US")} miles in ${v.city}, ${v.state}.`,
    v.description ?? "",
    `Seller financing: ${v.min_down_pct}% down, ${v.apr}% APR, ${v.allowed_terms.join("/")} months. Clean title, checked by OwnerFi. Message me to set up a test drive.`,
  ]
    .filter(Boolean)
    .join("\n\n");

/* Deterministic pseudo QR so the demo link has a stable picture. */
function Qr({ value, size = 144 }: { value: string; size?: number }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const ch of value) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rnd = () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
    const N = 25;
    const finders = [
      [0, 0],
      [18, 0],
      [0, 18],
    ] as const;
    const finder = (x: number, y: number): boolean | null => {
      for (const [fx, fy] of finders) {
        const i = x - fx;
        const j = y - fy;
        if (i < -1 || j < -1 || i > 7 || j > 7) continue;
        if (i < 0 || j < 0 || i > 6 || j > 6) return false;
        const d = Math.max(Math.abs(i - 3), Math.abs(j - 3));
        return d === 3 || d <= 1;
      }
      return null;
    };
    const out: [number, number][] = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const r = rnd();
        const f = finder(x, y);
        if (f === null ? r > 0.52 : f) out.push([x, y]);
      }
    return out;
  }, [value]);
  return (
    <svg
      role="img"
      aria-label={`QR code for ${value}`}
      width={size}
      height={size}
      viewBox="-2 -2 29 29"
      className="rounded-lg bg-white text-ink"
      shapeRendering="crispEdges"
    >
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  );
}

function LinkCard({ code }: { code: string }) {
  const toast = useToast();
  const url = `ownerfi.example/c/${code}`;
  return (
    <Card>
      <CardHeader title="Your link and QR code" description="Every ad uses this link. We count who clicks it." />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Qr value={url} />
        <div className="min-w-0 flex-1">
          <p className="num truncate rounded-lg bg-surface px-3 py-2 font-mono text-sm" title={url}>
            {url}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              leftIcon={<Copy aria-hidden className="h-4 w-4" />}
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText(`https://${url}`);
                } catch {
                  /* clipboard blocked */
                }
                toast({ tone: "success", title: "Link copied", description: "Paste it anywhere you like." });
              }}
            >
              Copy link
            </Button>
            <Popover
              trigger={({ props, toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  {...props}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink/15 bg-white px-5 text-[15px] font-semibold shadow-card hover:bg-surface"
                >
                  <Share2 aria-hidden className="h-4 w-4" /> Share
                </button>
              )}
              className="w-48 p-1.5"
            >
              {({ close }) => (
                <>
                  {["your messages", "your email", "WhatsApp"].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        close();
                        toast({ tone: "info", title: `Opening ${n}…`, description: `We’ll paste ${url} for you.` });
                      }}
                      className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium capitalize hover:bg-ink/5"
                    >
                      {n.replace("your ", "")}
                    </button>
                  ))}
                </>
              )}
            </Popover>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------- pick sites */

function ChannelCard({
  channel: c,
  selected,
  posted,
  disabledReason,
  onToggle,
}: {
  channel: Channel;
  selected: boolean;
  posted?: string | undefined;
  disabledReason?: string | undefined;
  onToggle: () => void;
}) {
  const initials = c.name
    .replace(/\.com$/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const locked = !!posted || !!disabledReason;
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-white p-4 transition-colors",
        selected ? "border-primary ring-2 ring-primary/30" : "border-ink/10",
        locked && "opacity-80",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface text-sm font-bold text-primary"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{c.name}</h3>
          <p className="text-sm text-muted">Up to {c.description} characters</p>
        </div>
        {posted && <StatusChip kind="adChannel" value={posted} />}
      </div>
      <p className="mt-3 text-sm text-muted">No requirements.</p>
      <p className="mt-1 text-sm">OwnerFi posts for you.</p>
      {disabledReason && <p className="mt-2 text-sm text-danger">{disabledReason}</p>}
      <div className="mt-auto pt-4">
        <Button
          variant={selected ? "primary" : "secondary"}
          fullWidth
          disabled={locked}
          aria-pressed={selected}
          onClick={onToggle}
          leftIcon={selected ? <Check aria-hidden className="h-4 w-4" /> : undefined}
        >
          {posted ? "Already posted" : selected ? "Selected" : "Select"}
        </Button>
      </div>
    </div>
  );
}

function ActionBar({ summary, reason, children }: { summary: string; reason?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-14 z-20 border-t border-ink/10 bg-white p-3 md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 lg:bottom-0">
      {reason && <p className="mb-2 text-sm text-muted md:text-right">{reason}</p>}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium" aria-live="polite">
          {summary}
        </span>
        <div className="flex gap-3">{children}</div>
      </div>
    </div>
  );
}

function Preview({ channel, vehicle: v, title, description }: { channel: Channel; vehicle: PublicVehicle; title: string; description: string }) {
  const t = clipText(title, channel.title);
  const d = clipText(description, channel.description);
  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-white">
      <div className="flex items-center justify-between bg-surface px-3 py-2 text-sm">
        <span className="font-semibold">{channel.name}</span>
        {(t.shortened || d.shortened) && (
          <span className="rounded-full bg-warning/10 px-2 text-xs font-semibold text-warning">Shortened to fit</span>
        )}
      </div>
      <CarImage src={v.photos[0]} alt={`Cover photo of your ${v.make} ${v.model}`} make={v.make} model={v.model} aspect="16/9" className="rounded-none" />
      <div className="p-3">
        <p className="font-semibold">{t.text || "Your title"}</p>
        <p className="num mt-1 text-lg font-bold text-primary">{moneyC(v.price_cents)}</p>
        <p className="mt-2 whitespace-pre-line text-sm text-muted">{d.text || "Your description"}</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- page */

function AdvertisePage() {
  const { id } = Route.useParams();
  const toast = useToast();
  const { vehicles, loading } = useSellerVehicles();
  const ads = useAds(id);
  const found = vehicles.find((x) => x.vehicle.id === id);
  const [step, setStep] = useState<"manage" | "pick" | "compose">("manage");
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | undefined>();

  if (loading && !found) {
    return (
      <div aria-busy="true" className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!found) {
    return (
      <EmptyState
        headingLevel={1}
        title="We can’t find that car"
        action={<ButtonLink to="/seller/vehicles">Back to my cars</ButtonLink>}
      />
    );
  }
  const { vehicle: v, status } = found;
  const canPost = status === "listed";
  const code = id.replace(/[^a-z0-9]/gi, "").slice(-6).toLowerCase();
  const name = (cid: string) => CHANNELS.find((c) => c.id === cid)?.name ?? cid;
  const chosen = CHANNELS.filter((c) => selected.includes(c.id));
  const activePreview = chosen.find((c) => c.id === previewId) ?? chosen[0];
  const state = ads.length === 0 && step === "manage" ? "pick" : step;

  const startCompose = () => {
    setTitle((t) => t || suggestTitle(v));
    setDescription((d) => d || suggestText(v));
    setStep("compose");
  };

  return (
    <div className="mx-auto max-w-6xl pb-24 md:pb-0">
      <Link
        to="/seller/vehicles/$id"
        params={{ id }}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> {carFullTitle(v)}
      </Link>
      <h1 className="text-[26px] font-bold leading-8 md:text-[32px] md:leading-10">Advertise everywhere</h1>
      <p className="mb-6 mt-1.5 max-w-2xl text-muted">
        {state === "pick"
          ? "Pick the sites to post on. We write the ad for you."
          : state === "compose"
            ? "Check your ad. You can change the words and photos."
            : "How each channel is doing."}
      </p>

      {!canPost && (
        <Alert tone="warning" className="mb-5">
          Publish your car to post ads. Paused cars can’t post new ads.
        </Alert>
      )}

      {state === "pick" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHANNELS.map((c) => (
              <ChannelCard
                key={c.id}
                channel={c}
                selected={selected.includes(c.id)}
                posted={ads.find((a) => a.channelId === c.id)?.status}
                disabledReason={v.photos.length < 3 ? `Add ${3 - v.photos.length} more photo(s) to use this.` : undefined}
                onToggle={() => setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))}
              />
            ))}
          </div>
          <ActionBar
            summary={`${selected.length} ${selected.length === 1 ? "channel" : "channels"} selected`}
            reason={selected.length === 0 ? "Pick at least one." : !canPost ? "Relist this car to post new ads." : undefined}
          >
            {ads.length > 0 && (
              <Button variant="secondary" onClick={() => setStep("manage")}>
                Back
              </Button>
            )}
            <Button disabled={selected.length === 0 || !canPost} onClick={startCompose}>
              Continue
            </Button>
          </ActionBar>
        </>
      )}

      {state === "compose" && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <TextInput
                label="Title"
                value={title}
                maxLength={80}
                helper={`${title.length}/80. Shown first, so lead with the deal.`}
                onChange={(e) => setTitle(e.target.value)}
              />
              <TextArea
                label="Description"
                rows={8}
                value={description}
                helper="Plain words work best. Say what the car is like and that buyers pay monthly."
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTitle(suggestTitle(v));
                  setDescription(suggestText(v));
                }}
              >
                Reset to suggested text
              </Button>
            </div>
            <div className="space-y-4">
              <section aria-label="Ad previews">
                <h2 className="mb-2 font-sans font-semibold tracking-normal">How it will look</h2>
                <div role="tablist" className="scrollbar-none mb-3 flex gap-1 overflow-x-auto border-b border-ink/10">
                  {chosen.map((c) => (
                    <button
                      key={c.id}
                      role="tab"
                      type="button"
                      aria-selected={c.id === activePreview?.id}
                      onClick={() => setPreviewId(c.id)}
                      className={cn(
                        "-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-semibold",
                        c.id === activePreview?.id ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink",
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                {activePreview && <Preview channel={activePreview} vehicle={v} title={title} description={description} />}
              </section>
              <LinkCard code={code} />
            </div>
          </div>
          <ActionBar
            summary={`${chosen.length} ${chosen.length === 1 ? "channel" : "channels"}`}
            reason={title.trim() ? undefined : "Add a title."}
          >
            <Button variant="secondary" onClick={() => setStep("pick")}>
              Back
            </Button>
            <Button
              disabled={!title.trim() || chosen.length === 0}
              onClick={() => {
                postAds(id, selected);
                setSelected([]);
                setStep("manage");
                toast({ tone: "success", title: "Posting your ad", description: "We’ll tell you when it’s live." });
              }}
            >
              Post to {chosen.length} {chosen.length === 1 ? "channel" : "channels"}
            </Button>
          </ActionBar>
        </>
      )}

      {state === "manage" && (
        <div className="space-y-6">
          {ads.some((a) => a.status === "queued" || a.status === "posting") && (
            <Card>
              <CardHeader title="Posting your ad" description="You can stay here while we post." />
              <p className="text-sm text-muted" aria-live="polite">
                {ads.filter((a) => a.status === "live" || a.status === "failed").length} of {ads.length} done
                {ads.some((a) => a.status === "failed") ? ` · ${ads.filter((a) => a.status === "failed").length} didn’t work` : ""}
              </p>
            </Card>
          )}
          {ads.some((a) => a.status === "failed") && !ads.some((a) => a.status === "queued" || a.status === "posting") && (
            <Alert tone="danger" title="Some ads didn’t go up.">
              Nothing was charged. Use Try again on each one.
            </Alert>
          )}
          <Card>
            <CardHeader
              title="Your ads"
              description="How each channel is doing."
              action={
                canPost ? (
                  <Button variant="secondary" onClick={() => setStep("pick")}>
                    Add channels
                  </Button>
                ) : undefined
              }
            />
            {ads.length === 0 ? (
              <EmptyState icon={<Megaphone aria-hidden className="h-6 w-6" />} title="No ads yet" description="Post to car sites and share your own link." />
            ) : (
              <ul className="divide-y divide-ink/10">
                {ads.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{name(a.channelId)}</p>
                      {a.status === "failed" ? (
                        <p className="text-sm text-danger">{a.error ?? "Posting failed."}</p>
                      ) : (
                        <p className="num text-sm text-muted">
                          {a.impressions} views · {a.clicks} clicks · {a.inquiries} questions
                        </p>
                      )}
                      {a.url && a.status !== "failed" && (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">
                          View on {name(a.channelId)}
                        </a>
                      )}
                    </div>
                    {a.status === "failed" && canPost && (
                      <Button size="sm" variant="secondary" onClick={() => retryAd(a.id)}>
                        Try again
                      </Button>
                    )}
                    <StatusChip kind="adChannel" value={a.status} />
                    <Popover
                      align="right"
                      className="w-44 p-1.5"
                      trigger={({ props, toggle }) => (
                        <button
                          type="button"
                          onClick={toggle}
                          {...props}
                          aria-label={`Actions for ${name(a.channelId)}`}
                          className="rounded-xl p-2 text-muted hover:bg-ink/5"
                        >
                          <MoreHorizontal aria-hidden className="h-5 w-5" />
                        </button>
                      )}
                    >
                      {({ close }) => (
                        <>
                          {a.status === "live" && (
                            <button
                              type="button"
                              className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-ink/5"
                              onClick={() => {
                                close();
                                setAdStatus(id, "live", "paused");
                                toast({ tone: "success", title: "Ad paused" });
                              }}
                            >
                              Pause
                            </button>
                          )}
                          {a.status === "paused" && canPost && (
                            <button
                              type="button"
                              className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-ink/5"
                              onClick={() => {
                                close();
                                setAdStatus(id, "paused", "live");
                                toast({ tone: "success", title: "Ad is live again" });
                              }}
                            >
                              Resume
                            </button>
                          )}
                          {a.status !== "queued" && a.status !== "posting" && (
                            <button
                              type="button"
                              className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-danger hover:bg-ink/5"
                              onClick={() => {
                                close();
                                setRemoving(a.id);
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                    </Popover>
                  </li>
                ))}
              </ul>
            )}
            {ads.length > 0 && (
              <p className="num mt-3 text-sm font-semibold">
                All channels: {ads.reduce((s, a) => s + a.impressions, 0)} views · {ads.reduce((s, a) => s + a.clicks, 0)} clicks ·{" "}
                {ads.reduce((s, a) => s + a.inquiries, 0)} questions
              </p>
            )}
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <LinkCard code={code} />
            <Card>
              <CardHeader title="Recent activity" />
              {ads.length === 0 ? (
                <p className="text-sm text-muted">Nothing yet. Post an ad and it will show up here.</p>
              ) : (
                <ul className="divide-y divide-ink/10">
                  {ads.map((a) => (
                    <li key={a.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <span>
                        {a.status === "failed" ? "Couldn’t post on " : a.status === "live" ? "Live on " : "Posting on "}
                        <strong>{name(a.channelId)}</strong>
                      </span>
                      <span className="shrink-0 text-muted">{new Date(a.postedAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        size="sm"
        title={removing ? `Remove from ${name(ads.find((a) => a.id === removing)?.channelId ?? "")}?` : "Remove ad?"}
        description="It stops showing there. Your OwnerFi listing stays live."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (removing) removeAd(removing);
                setRemoving(null);
                toast({ tone: "success", title: "Ad removed" });
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <span />
      </Modal>
    </div>
  );
}
