# Work done: cartest vs. the ownerfi-poc.devgate.ca reference

Goal: make `cartest` (TanStack Start + Tailwind v4 + Supabase + local demo store) look and behave like https://ownerfi-poc.devgate.ca/.

## Starting point vs. now

| Area | At the start | Now |
|---|---|---|
| Design system | Different theme (purple), ad-hoc components, different copy | Reference tokens (colors, shadows, fonts Inter + Space Grotesk), 4 switchable themes, shared UI kit (`src/components/kit.tsx`, `kit-extra.tsx`) |
| Public site | Basic landing and car pages | Landing, car browse, car detail (gating, Ask and Test drive modals), offer page, matching the reference |
| Auth | Simple login/signup | `/auth/*` flows: signup with role picker, login, verify code, 2-step for admin, forgot/reset password, suspended page, demo inbox (code 123456, password Demo1234!) |
| Portal shell | Old header-style shell | Dark sidebar, top bar with search, notifications, account menu, mobile tab bar, route guards (`/no-access` for wrong role) |
| Seller area | Partial | Home, vehicles (add-car wizard, detail, advertise), inbox, deals, test drives and availability, payments, notifications, onboarding (identity, payouts), account |
| Buyer area | Partial | Home, verification steps, saved cars, inbox, deals, test drives, payments (autopay, receipts, payoff), notifications, account |
| Deal Room | One 1,348-line page with the old look | Rebuilt: header, 10-step stepper, "Your next step" banner, per-stage actions, risk summary, numbers, people, documents, chat. Now a shared component used by seller, buyer and admin |
| Admin | One page with mock tabs | Full console (below) |
| Checks | Not re-run | `tsc` clean, `npm run build` passes, 13 vitest tests pass |

## Delivered, by phase

1. **Public + Auth**: design system, landing, cars, offer, all auth flows, demo mailbox.
2. **Portal shell + Seller**: sidebar/top bar/mobile nav, seller pages listed above.
3. **Buyer**: verification, saved, inbox, deals, payments, payoff, account.
4. **Deal Room rebuild**: moved to `src/components/app/DealRoom.tsx`; all existing store actions kept (confirm drive, approve, counter, decline, withdraw, inspection, sign, pay, close, installments).
5. **Admin console**:
   - Shell with 5 sidebar groups and a mobile menu.
   - Pages: dashboard, verifications (bulk approve, reject, request info), users + detail (suspend, reinstate, reset 2-step, notes, fee waiver, View as), vehicles + detail (approve, request changes, take down, flags), deals (board/table) + admin deal page (pause, escalate, cancel, default, notes), test drives (calendar/table), closed deals (CSV), revenue (chart, ledger, CSV), payments (refunds, disputes), advertising + partner detail, integrations + detail, settings (fees, state rules, policies, team), audit log, support, notifications, account.
   - Data layer: `src/lib/admin-data.ts` and `admin-seed.ts`. Admin decisions persist in the browser and write to the audit log.

## Other changes
- `demo-store.tsx`: added vehicle edits, an admin stage override, and fixes to the installment payment flow.
- `session.ts`: added a ready flag and `impersonate`.
- `roadmap.md` updated.

## Known differences and what's left
- Admin data is derived from the demo store plus invented mock data (older closed deals, ad partners, integrations, support tickets).
- Revenue totals use the monthly demo figures, so they don't exactly match the fee ledger rows.
- Only the verification-approve action was clicked through in the browser; the other admin actions were written but not manually exercised.
- Remaining roadmap items: full notification seed data and mock vendor adapters.
