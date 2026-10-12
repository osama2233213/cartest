# OwnerFi roadmap (from OwnerFi_PRD.md)

Target: match the reference build at https://ownerfi-poc.devgate.ca/ (UI, UX and behaviour).

- [x] Backend on, core tables (roles, profiles, state rules, settings, vehicles) + seed cars
- [x] Design tokens, finance library + tests (worked example passes)
- [x] Design system matched to the reference: 4 colour themes (blue default), Inter + Space Grotesk, shared kit (`src/components/kit.tsx`)
- [x] Public site: landing, /cars (filters, sort, URL state, pagination), /cars/:id (gating, test drive, ask, save), /cars/:id/offer
- [x] Auth (demo, client-side): /auth/signup (role picker), /auth/login (+ demo accounts), /auth/verify, /auth/2fa (admin), /auth/forgot, /auth/reset/:token, /auth/suspended
- [x] /demo/inbox, demo toolbar, 404 and /no-access pages
- [x] Portal shell: dark sidebar, top bar with search, notifications bell, mobile tab bar (seller + buyer + admin)
- [x] Seller: home, onboarding (identity, payouts), vehicles list + detail, 7-step wizard, advertise, inbox, test drives (+ availability), deals, default options, payments, notifications, account
- [x] Buyer: home, verification (identity, bank, credit), saved, inbox, test drives, deals, payoff, payments, notifications, account
- [ ] Deals: schema + server-side advance_deal state machine, offers, Deal Room
- [ ] Verification hub + mocked vendor adapters (VIN via NHTSA)
- [ ] Payments: monthly, late/default timeline, payoff + lien release
- [x] Account area for sellers (profile, security, notifications, verification, documents, payouts, close account); buyer version done
- [x] Admin: dashboard, verifications, users (+ impersonate), vehicles, deals, test drives, closed deals, revenue, payments, advertising, integrations, settings tabs, audit log, support
- [ ] Notifications centre and full seed data
