import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Info, Inbox as InboxIcon, MoreVertical, Send, X } from "lucide-react";
import { Avatar, Button, Card, EmptyState, Modal, NativeSelect, PageHeader, Popover, TextArea } from "@/components/kit";
import { Calendar as Cal, TimeSlots, sameDay } from "@/components/kit-extra";
import { CarImage } from "@/components/site/cars";
import { StatusChip } from "@/components/status";
import { STAGE_LABEL, termsFor, type DemoDeal, type Stage } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";
import { moneyC } from "@/lib/format";
import { QUICK_REPLIES, markSeen, useReadMap } from "@/lib/inbox";
import { openSlots, useAvailability, useDrives } from "@/lib/drives";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

type Role = "seller" | "buyer";

function useThreads(role: Role) {
  const user = useCurrentUser();
  const { deals, getDealDetail } = useDemoStore();
  const read = useReadMap();
  return useMemo(() => {
    const mine = deals.filter((d) => (role === "seller" ? d.seller : d.buyer) === user?.name);
    return mine
      .map((deal) => {
        const messages = getDealDetail(deal.id).messages;
        const last = messages.at(-1);
        const seen = read[`${user?.id}:${deal.id}`] ?? (last && last.sender === role ? messages.length : 0);
        const fromOther = messages.filter((m) => m.sender !== role);
        const unread = last && last.sender !== role && seen < messages.length ? fromOther.length - messages.slice(0, seen).filter((m) => m.sender !== role).length : 0;
        return { deal, messages, last, unread };
      })
      .filter((t) => t.messages.length > 0 || true);
  }, [deals, getDealDetail, read, role, user?.id, user?.name]);
}

export function useUnreadCount(role: Role) {
  return useThreads(role).reduce((n, t) => n + (t.unread > 0 ? 1 : 0), 0);
}

function Row({ t, role, active }: { t: ReturnType<typeof useThreads>[number]; role: Role; active: boolean }) {
  const other = role === "seller" ? t.deal.buyer : t.deal.seller;
  return (
    <li>
      <Link
        to={`/${role}/inbox/$threadId` as never}
        params={{ threadId: t.deal.id } as never}
        aria-current={active || undefined}
        className={cn("flex gap-3 border-b border-ink/[0.06] px-3 py-3.5 hover:bg-surface", active && "bg-primary/5")}
      >
        <span className="relative shrink-0">
          <CarImage src={t.deal.photo} alt="" className="h-12 w-12 !rounded-xl" aspect="square" />
          <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-white">
            <Avatar name={other} size="sm" className="!h-6 !w-6 !text-[10px]" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate", t.unread ? "font-bold" : "font-semibold")}>{other.split(" ")[0]}</span>
            <span className="shrink-0 text-xs text-muted">{t.last?.time ?? t.deal.updated}</span>
          </span>
          <span className="block truncate text-xs text-muted">{t.deal.car}</span>
          <span className={cn("block truncate text-sm", t.unread ? "font-semibold text-ink" : "text-muted")}>
            {t.last?.text ?? "No messages yet"}
          </span>
        </span>
        {t.unread > 0 && <span aria-label="Unread" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
      </Link>
    </li>
  );
}

function OfferTimes({ deal, onClose, onSend }: { deal: DemoDeal; onClose: () => void; onSend: (text: string) => void }) {
  const av = useAvailability();
  const drives = useDrives();
  const [picked, setPicked] = useState<string[]>([]);
  const [day, setDay] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const slots = useMemo(
    () => openSlots(av, drives.filter((d) => d.sellerName === deal.seller), new Date(), new Date(Date.now() + 30 * 86_400_000)),
    [av, drives, deal.seller],
  );
  const first = deal.buyer.split(" ")[0];
  return (
    <Modal
      open
      onClose={onClose}
      title={`Offer times to ${first}`}
      description="Pick up to 3 times. We’ll send them in your chat. Nothing is booked until they choose one."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={picked.length === 0}
            onClick={() => {
              const list = picked.map((p) => format(new Date(p), "EEE, MMM d 'at' h:mm a")).join(", or ");
              onSend(`I can meet ${list}.${note ? ` ${note}` : ""}`);
              onClose();
            }}
          >
            Send times
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Cal
          value={day}
          onChange={setDay}
          minDate={new Date(Date.now() + 86_400_000)}
          availableDates={slots}
          disabledDate={(d) => !slots.some((s) => sameDay(s, d))}
          className="max-w-none"
        />
        {day ? (
          <TimeSlots
            label={`Times on ${format(day, "EEEE, MMM d")}`}
            slots={slots
              .filter((s) => sameDay(s, day))
              .map((s) => ({ id: s.toISOString(), label: format(s, "h:mm a"), disabled: picked.includes(s.toISOString()) }))}
            value={null}
            onChange={(id) => picked.length < 3 && setPicked([...picked, id].sort())}
          />
        ) : (
          <p className="text-sm text-muted">Pick a day with a dot to see times.</p>
        )}
        {picked.length > 0 && (
          <ul aria-label="Times you picked" className="flex flex-wrap gap-2">
            {picked.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => setPicked(picked.filter((x) => x !== p))}
                  className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"
                >
                  {format(new Date(p), "EEE, MMM d · h:mm a")} ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <TextArea label="Note (optional)" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

function Conversation({ t, role }: { t: ReturnType<typeof useThreads>[number]; role: Role }) {
  const { sendMessage } = useDemoStore();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [banner, setBanner] = useState(true);
  const [offering, setOffering] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const other = role === "seller" ? t.deal.buyer : t.deal.seller;
  const terms = termsFor(t.deal);

  useEffect(() => {
    if (user) markSeen(user.id, t.deal.id, t.messages.length);
    end.current?.scrollIntoView({ block: "end" });
  }, [t.messages.length, t.deal.id, user]);

  // Messaging needs a signed-in person with a verified email.
  const blocked = !user ? "Sign in to send messages." : !user.emailVerified ? "Verify your email to message sellers." : "";
  const send = (body: string) => {
    const v = body.trim();
    if (!v || blocked) return;
    sendMessage(t.deal.id, role, v);
    setText("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-ink/[0.08] p-3">
        <button
          type="button"
          aria-label="Back to messages"
          onClick={() => navigate({ to: `/${role}/inbox` as never })}
          className="rounded-xl p-2 text-ink hover:bg-ink/5 lg:hidden"
        >
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </button>
        <Avatar name={other} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{other}</p>
          <p className="text-xs text-muted">{other.split(" ")[0]} is {role === "seller" ? "ID-verified" : "a verified seller"}</p>
        </div>
        {role === "seller" && ["inquiry", "test_drive", "application", "negotiation"].includes(t.deal.stage) && (
          <Button size="sm" variant="secondary" className="hidden sm:inline-flex" onClick={() => setOffering(true)}>
            Offer test-drive times
          </Button>
        )}
        <Popover
          align="right"
          className="w-56 p-1.5"
          trigger={({ props, toggle }) => (
            <button type="button" onClick={toggle} {...props} aria-label="More" className="rounded-xl p-2 text-muted hover:bg-ink/5">
              <MoreVertical aria-hidden className="h-5 w-5" />
            </button>
          )}
        >
          {({ close }) => (
            <>
              {role === "seller" && (
                <button
                  type="button"
                  className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-ink/5 sm:hidden"
                  onClick={() => {
                    close();
                    setOffering(true);
                  }}
                >
                  Offer test-drive times
                </button>
              )}
              <Link
                to="/deals/$id"
                params={{ id: t.deal.id }}
                search={{ as: role } as never}
                onClick={close}
                className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-ink/5"
              >
                Open the deal
              </Link>
            </>
          )}
        </Popover>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <Link
          to="/deals/$id"
          params={{ id: t.deal.id }}
          search={{ as: role } as never}
          className="flex items-center gap-3 rounded-2xl border border-ink/[0.08] bg-white p-3 hover:bg-surface"
        >
          <CarImage src={t.deal.photo} alt="" className="h-12 w-16 shrink-0 !rounded-xl" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{t.deal.car}</span>
            <span className="num block truncate text-sm text-muted">
              {moneyC(t.deal.priceCents)} · from {moneyC(terms.down)} down, about {moneyC(terms.monthly)}/mo
            </span>
          </span>
          <StatusChip kind="deal" value={t.deal.stage} />
        </Link>
        {banner && (
          <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary-50 p-3 text-sm">
            <Info aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="flex-1">Keep chats and payments inside OwnerFi. Meet in a public place. We never ask for your password or codes.</p>
            <button type="button" aria-label="Dismiss" onClick={() => setBanner(false)} className="self-start text-muted">
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        )}
        {t.messages.length === 0 && <p className="py-8 text-center text-sm text-muted">No messages yet. Say hello.</p>}
        {t.messages.map((m) => {
          const mine = m.sender === role;
          return (
            <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5",
                  mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-surface text-ink",
                )}
              >
                {m.text}
              </p>
              <span className="mt-1 text-xs text-muted">{m.time}</span>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <div className="border-t border-ink/[0.08] p-3">
        {blocked && (
          <div role="alert" className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-sm">
            <span className="flex-1 font-medium">{blocked}</span>
            {user && !user.emailVerified && (
              <Button size="sm" variant="secondary" onClick={() => window.dispatchEvent(new Event("ownerfi:verify-email"))}>
                Verify email
              </Button>
            )}
          </div>
        )}
        <div className="scrollbar-none -mx-1 mb-2 flex gap-2 overflow-x-auto px-1">
          {QUICK_REPLIES[role].map((q) => (
            <button
              key={q}
              type="button"
              disabled={!!blocked}
              onClick={() => send(q)}
              className="shrink-0 disabled:opacity-50 rounded-full border border-ink/15 px-3 py-1.5 text-sm font-medium hover:bg-surface"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <textarea
            aria-label="Write a message"
            rows={1}
            value={text}
            disabled={!!blocked}
            placeholder={blocked || "Write a message"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-ink/15 px-3.5 py-2.5 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          />
          <Button type="submit" disabled={!text.trim() || !!blocked} leftIcon={<Send aria-hidden className="h-4 w-4" />}>
            Send
          </Button>
        </form>
      </div>
      {offering && <OfferTimes deal={t.deal} onClose={() => setOffering(false)} onSend={send} />}
    </div>
  );
}

export function InboxPage({ role, threadId }: { role: Role; threadId?: string | undefined }) {
  const threads = useThreads(role);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [car, setCar] = useState("");
  const [stage, setStage] = useState("");
  const cars = [...new Set(threads.map((t) => t.deal.car))];
  const stages = [...new Set(threads.map((t) => t.deal.stage))];
  const shown = threads.filter(
    (t) => (tab === "all" || t.unread > 0) && (!car || t.deal.car === car) && (!stage || t.deal.stage === stage),
  );
  const active = threads.find((t) => t.deal.id === threadId);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Inbox" />
      {threads.length === 0 ? (
        <EmptyState
          icon={<InboxIcon aria-hidden className="h-6 w-6" />}
          title="No messages yet"
          description={role === "seller" ? "When a buyer asks a question, it shows up here." : "Ask a seller a question from any car page."}
        />
      ) : (
        <Card padding="none" className="overflow-hidden lg:grid lg:h-[calc(100vh-13rem)] lg:min-h-[28rem] lg:grid-cols-[minmax(0,340px)_1fr]">
          <div className={cn("flex min-h-0 flex-col lg:border-r lg:border-ink/[0.08]", active && "hidden lg:flex")}>
            <div className="space-y-2 border-b border-ink/[0.08] p-3">
              <div role="tablist" className="inline-flex rounded-xl bg-surface p-1">
                {(["all", "unread"] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    type="button"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={cn("h-8 rounded-lg px-4 text-sm font-semibold capitalize", tab === k ? "bg-white shadow-card" : "text-muted")}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NativeSelect
                  size="sm"
                  aria-label="Filter by car"
                  value={car}
                  onChange={(e) => setCar(e.target.value)}
                  options={[{ value: "", label: "All cars" }, ...cars.map((c) => ({ value: c, label: c }))]}
                />
                <NativeSelect
                  size="sm"
                  aria-label="Filter by stage"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  options={[{ value: "", label: "Any stage" }, ...stages.map((s) => ({ value: s, label: STAGE_LABEL[s as Stage] }))]}
                />
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {shown.length === 0 ? (
                <li className="p-6 text-center text-sm text-muted">No conversations match.</li>
              ) : (
                shown.map((t) => <Row key={t.deal.id} t={t} role={role} active={t.deal.id === threadId} />)
              )}
            </ul>
          </div>
          <div className={cn("min-h-[32rem] min-w-0 lg:min-h-0", !active && "hidden lg:block")}>
            {active ? (
              <Conversation key={active.deal.id} t={active} role={role} />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-muted">Pick a conversation</div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

