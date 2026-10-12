import { pushNotice } from "./notifications";
import { channelsFor, type EventKey } from "./prefs";
import { addMail, getSessionState, type Mail } from "./session";

/**
 * Tells someone about an event on the channels they chose in Account, Notifications:
 * push is the in-app bell, email and text go to the demo inbox. A channel they turned off gets nothing.
 */
export function notify(userId: string, event: EventKey, n: { title: string; body: string; href: string; tag?: Mail["tag"] }) {
  const ch = channelsFor(userId, event);
  const u = getSessionState().users.find((x) => x.id === userId);
  const sent: ("push" | "email" | "sms")[] = [];
  if (ch.push) {
    pushNotice({ userId, title: n.title, body: n.body, href: n.href });
    sent.push("push");
  }
  if (ch.email && u?.email) {
    addMail({ to: u.email, kind: "email", subject: n.title, body: n.body, tag: n.tag ?? "other" });
    sent.push("email");
  }
  if (ch.sms && u?.phone) {
    addMail({ to: u.phone, kind: "sms", body: `${n.title}. ${n.body}`, tag: n.tag ?? "other" });
    sent.push("sms");
  }
  return sent;
}
