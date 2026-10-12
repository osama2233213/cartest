import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, Inbox, Mail as MailIcon, MessageSquare } from "lucide-react";
import {
  Alert,
  AppLink,
  Badge,
  Button,
  ButtonLink,
  Card,
  Chip,
  EmptyState,
  NativeSelect,
  PageHeader,
  Segmented,
  useToast,
} from "@/components/kit";
import { SiteLayout } from "@/components/site/SiteChrome";
import { useAuth } from "@/lib/auth-store";
import { useSession, type Mail } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demo/inbox")({
  validateSearch: (s: Record<string, unknown>): { to?: string | undefined; id?: string | undefined } => ({
    ...(typeof s["to"] === "string" ? { to: s["to"] } : {}),
    ...(typeof s["id"] === "string" ? { id: s["id"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Demo inbox · OwnerFi" }] }),
  component: DemoInbox,
});

const TAGS: { value: Mail["tag"]; label: string }[] = [
  { value: "otp", label: "Codes" },
  { value: "reset", label: "Password reset" },
  { value: "test_drive", label: "Test drive" },
  { value: "contract", label: "Contract" },
  { value: "receipt", label: "Receipt" },
  { value: "late", label: "Late notice" },
  { value: "other", label: "Other" },
];
const tagLabel = (t: string) => TAGS.find((x) => x.value === t)?.label ?? "Other";

const codeOf = (m: Mail) => (m.tag === "otp" ? (/\b(\d{6})\b/.exec(m.body)?.[1] ?? null) : null);
const linkOf = (m: Mail) => /(?:https?:\/\/[^\s/]+)?(\/(?:auth|seller|buyer|admin)\/[^\s]*[^\s.,])/.exec(m.body)?.[1] ?? null;
const titleOf = (m: Mail) => {
  const t = m.subject ?? m.body;
  return t.length > 48 ? `${t.slice(0, 45)}…` : t;
};

function MailRow({ items, selectedId, freshId, onSelect }: { items: Mail[]; selectedId?: string | undefined; freshId?: string | undefined; onSelect: (m: Mail) => void }) {
  return (
    <ul className="divide-y divide-ink/10">
      {items.map((m) => {
        const Icon = m.kind === "sms" ? MessageSquare : MailIcon;
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelect(m)}
              aria-current={m.id === selectedId || undefined}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                m.id === selectedId && "bg-primary/5",
              )}
            >
              <Icon aria-hidden className="mt-1 h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{titleOf(m)}</span>
                  {m.id === freshId && <Badge tone="primary">New</Badge>}
                </span>
                <span className="block truncate text-sm text-muted">{m.to}</span>
                <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <Badge>{tagLabel(m.tag)}</Badge>
                  {formatDistanceToNow(new Date(m.at), { addSuffix: true })}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MailView({ mail, onBack }: { mail: Mail; onBack: () => void }) {
  const toast = useToast();
  const code = codeOf(mail);
  const link = linkOf(mail);
  return (
    <div className="p-4 sm:p-6">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary lg:hidden">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to messages
      </button>
      {mail.kind === "email" ? (
        <article className="rounded-2xl border border-ink/10 bg-white p-5">
          <dl className="space-y-1 border-b border-ink/10 pb-4 text-sm">
            <div className="flex gap-2">
              <dt className="w-14 text-muted">From</dt>
              <dd>OwnerFi &lt;hello@ownerfi.io&gt;</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-14 text-muted">To</dt>
              <dd className="break-all">{mail.to}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-14 text-muted">Date</dt>
              <dd>{format(new Date(mail.at), "PP p")}</dd>
            </div>
          </dl>
          <h2 className="mt-4 font-sans text-lg font-semibold tracking-normal">{mail.subject}</h2>
          <p className="mt-3 whitespace-pre-line">{mail.body}</p>
        </article>
      ) : (
        <div className="mx-auto max-w-sm">
          <p className="mb-2 text-center text-xs text-muted">
            Text message to {mail.to} · {format(new Date(mail.at), "p")}
          </p>
          <p className="rounded-2xl rounded-bl-sm bg-surface px-4 py-3">{mail.body}</p>
        </div>
      )}
      {code && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-surface p-4">
          <span className="font-mono text-3xl font-bold tracking-widest" aria-label={`Code ${code}`}>
            {code}
          </span>
          <Button
            variant="secondary"
            leftIcon={<Copy aria-hidden className="h-4 w-4" />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
              } catch {
                /* clipboard blocked */
              }
              toast({ title: "Code copied", tone: "success" });
            }}
          >
            Copy code
          </Button>
        </div>
      )}
      {link && (
        <ButtonLink className="mt-4" to={link}>
          Open in the app
        </ButtonLink>
      )}
    </div>
  );
}

function DemoInbox() {
  const { to = "", id } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mailbox, users } = useSession();
  const [kind, setKind] = useState("all");
  const [tag, setTag] = useState("");
  const [freshId, setFreshId] = useState<string | undefined>();
  const seen = useRef<number | null>(null);

  // Highlight a message that arrives while the page is open.
  useEffect(() => {
    if (seen.current !== null && mailbox.length > seen.current && mailbox[0]) {
      const fresh = mailbox[0].id;
      setFreshId(fresh);
      const t = setTimeout(() => setFreshId(undefined), 5000);
      seen.current = mailbox.length;
      return () => clearTimeout(t);
    }
    seen.current = mailbox.length;
    return undefined;
  }, [mailbox]);

  const setParam = (key: "to" | "id", value?: string) =>
    navigate({
      to: "/demo/inbox",
      search: ((prev: { to?: string; id?: string }) => ({ ...prev, [key]: value || undefined })) as never,
      replace: true,
    });

  const sorted = [...mailbox].sort((a, b) => b.at.localeCompare(a.at));
  const shown = sorted.filter((m) => (!to || m.to === to) && (kind === "all" || m.kind === kind) && (!tag || m.tag === tag));
  const selected = shown.find((m) => m.id === id) ?? sorted.find((m) => m.id === id);

  const recipients = Array.from(new Set(mailbox.map((m) => m.to))).map((addr) => ({
    to: addr,
    label: users.find((u) => u.email === addr || u.phone === addr)?.name
      ? `${users.find((u) => u.email === addr || u.phone === addr)!.name} · ${addr}`
      : addr,
  }));
  if (to && !recipients.some((r) => r.to === to)) recipients.push({ to, label: to });

  const clear = () => {
    setKind("all");
    setTag("");
    setParam("to");
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <PageHeader title="Demo inbox" description="Every email and text the app “sends” lands here." />
        <Alert tone="info" className="mb-4">
          Demo only. In the real product these go to email and phone. Nothing is actually sent.{" "}
          <AppLink className="font-medium underline" to={user ? `/${user.role}` : "/"}>
            {user ? "Back to the app" : "Back to the site"}
          </AppLink>
        </Alert>
        <Card className="mb-4 p-4">
          <div className="space-y-3">
            <NativeSelect
              label="Sent to"
              value={to}
              onChange={(e) => setParam("to", e.target.value)}
              options={[{ value: "", label: "Everyone" }, ...recipients.map((r) => ({ value: r.to, label: r.label }))]}
            />
            <div>
              <span className="mb-1.5 block text-sm font-medium">Type</span>
              <Segmented
                label="Type"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all", label: "All" },
                  { value: "email", label: "Email" },
                  { value: "sms", label: "SMS" },
                ]}
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Message type">
              {TAGS.map((t) => (
                <Chip key={t.value} selected={tag === t.value} onClick={() => setTag(tag === t.value ? "" : t.value)}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>
        </Card>

        {mailbox.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Inbox aria-hidden className="h-6 w-6" />}
              title="No messages yet"
              description="Try signing up or resetting a password. The messages land here."
              action={<Button onClick={() => window.history.back()}>Go back</Button>}
            />
          </Card>
        ) : shown.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Inbox aria-hidden className="h-6 w-6" />}
              title="Nothing matches"
              description="Try a different person or type."
              action={
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden lg:grid lg:grid-cols-[360px_1fr]">
            <div className={selected ? "hidden lg:block lg:border-r lg:border-ink/10" : "lg:border-r lg:border-ink/10"}>
              <MailRow items={shown} selectedId={selected?.id} freshId={freshId} onSelect={(m) => setParam("id", m.id)} />
            </div>
            <div className={selected ? "" : "hidden lg:block"}>
              {selected ? (
                <MailView mail={selected} onBack={() => setParam("id")} />
              ) : (
                <p className="p-8 text-center text-muted">Pick a message to read it.</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </SiteLayout>
  );
}
