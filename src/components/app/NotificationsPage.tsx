import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bell } from "lucide-react";
import { Button, EmptyState, PageHeader } from "@/components/kit";
import { NoticeRow, groupByDay } from "@/components/app/PortalShell";
import { useNotices } from "@/lib/notifications";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export function NotificationsPage({ role }: { role: "seller" | "buyer" | "admin" }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { items, unread, markRead, markUnread } = useNotices(user?.id);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const shown = tab === "all" ? items : items.filter((n) => !n.read);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description={role === "seller" ? "Everything that happened on your cars and deals." : role === "admin" ? "Alerts from across OwnerFi." : "Everything that happened on your searches and deals."}
        action={
          <Button variant="secondary" disabled={unread === 0} onClick={() => markRead()}>
            Mark all as read
          </Button>
        }
      />
      <div role="tablist" className="mb-4 flex gap-1 border-b border-ink/10">
        {(
          [
            ["all", "All"],
            ["unread", `Unread (${unread})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-3 text-sm font-semibold md:px-4",
              tab === id ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState
          icon={<Bell aria-hidden className="h-6 w-6" />}
          title={tab === "unread" ? "You’re all caught up" : "Nothing yet"}
          description={tab === "unread" ? "No unread notifications." : "We’ll tell you here when something happens."}
        />
      ) : (
        <div className="space-y-5">
          {groupByDay(shown).map((g) => (
            <section key={g.label}>
              <h2 className="eyebrow mb-1 px-3 font-sans text-muted">{g.label}</h2>
              <ul className="rounded-2xl border border-ink/[0.08] bg-white p-1 shadow-card">
                {g.items.map((n) => (
                  <NoticeRow
                    key={n.id}
                    n={n}
                    onOpen={(x) => {
                      markRead(x.id);
                      navigate({ to: x.href as never });
                    }}
                    onToggle={(x) => (x.read ? markUnread(x.id) : markRead(x.id))}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
