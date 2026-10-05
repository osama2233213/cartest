<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Money is integer cents; all deal math goes through pure functions in `src/lib/finance.ts` (tested in `finance.test.ts`) — one source of truth for every UI surface.
- Public car data is read via server functions using a publishable-key client and an explicit safe-column list — sellers' PII never leaves the server.
- Roles live in `user_roles` and are checked with `has_role()`; never on profiles — prevents privilege escalation.
- Deal stage transitions must happen server-side only — clients cannot skip stages.
- Spec uses React Router/Edge Functions; this stack uses TanStack Router + server functions instead — platform constraint.
