import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns/format";
import { FileText, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLink, Button, Card } from "@/components/kit";
import { resolveLink, type LinkResult } from "@/lib/doc-links";
import { useCurrentUser, useSessionReady } from "@/lib/session";

export const Route = createFileRoute("/docs/$token")({
  head: () => ({ meta: [{ title: "Document · OwnerFi" }, { name: "robots", content: "noindex" }] }),
  component: DocPage,
});

const WHY = {
  invalid: ["This link isn’t valid", "It may have been mistyped. Open the document again from your account."],
  expired: ["This link has expired", "Document links only work for a few minutes. Open the document again from your account."],
  signed_out: ["Sign in to see this document", "Documents are private. Sign in as the person it belongs to."],
  not_owner: ["This isn’t your document", "Only the people named on a document can open it."],
} as const;

function DocPage() {
  const { token } = Route.useParams();
  const ready = useSessionReady();
  const user = useCurrentUser();
  const [res, setRes] = useState<LinkResult | null>(null);

  useEffect(() => {
    if (ready) setRes(resolveLink(token, user?.id ?? null));
  }, [ready, token, user?.id]);

  if (!ready || !res) return <div aria-busy="true" className="min-h-screen bg-surface" />;

  if (!res.ok) {
    const [title, text] = WHY[res.reason];
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink/5 text-muted">
          <Lock aria-hidden className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-muted">{text}</p>
        <AppLink to={res.reason === "signed_out" ? "/auth/login" : "/"} className="mt-6 font-semibold text-primary hover:underline">
          {res.reason === "signed_out" ? "Sign in" : "Go home"}
        </AppLink>
      </main>
    );
  }

  const { doc, expiresAt } = res;
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-muted">
        Private link · expires {format(new Date(expiresAt), "h:mm a")} · only you can open it
      </p>
      <Card className="mt-3 space-y-4 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
            <FileText aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">{doc.title}</h1>
            {doc.detail && <p className="text-sm text-muted">{doc.detail}</p>}
          </div>
        </div>
        {doc.kind === "identity" ? (
          <div className="grid h-48 place-items-center rounded-2xl border border-dashed border-ink/20 bg-surface text-sm text-muted">ID photo on file (hidden in this demo)</div>
        ) : (
          <div className="space-y-2 rounded-2xl bg-surface p-4 text-sm">
            <p className="font-semibold">{doc.kind === "bill_of_sale" ? "Bill of sale" : "Retail installment financing agreement"}</p>
            <p className="text-muted">Document reference {doc.id}. This is a demo copy. The full signed PDF would open here.</p>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </Card>
    </main>
  );
}
