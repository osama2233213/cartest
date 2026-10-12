# OwnerFi: idea and implementation

## The idea
OwnerFi is a marketplace where a private seller sells a used car and finances it themselves ("be the bank"). The buyer pays a down payment and then monthly payments straight to the seller. OwnerFi earns a fee of 10% of the down payment and takes nothing from monthly payments.

Three kinds of users:
- **Seller**: lists cars, sets terms (price, minimum down payment, interest rate, length), reviews offers, signs, and gets paid.
- **Buyer**: browses cars, books test drives, makes offers, signs, pays the down payment and monthly installments.
- **Admin**: verifies people and cars, handles deals, money, advertising, integrations and support.

A deal moves through 10 steps: questions, test drive, offer, negotiation, inspection, contract, down payment, closing at the DMV, monthly payments, paid off.

This project is a demo that copies the look and behavior of https://ownerfi-poc.devgate.ca/. No real money, emails or ID checks happen.

## Tech stack
- TanStack Start and TanStack Router (file-based routes in `src/routes`)
- React, Tailwind v4 (theme tokens in `src/styles.css`)
- Supabase for the public car list; everything else is a local demo layer
- Recharts for charts, Vitest for tests

## How it is built

**Design system.** Color and shadow tokens are CSS variables, mapped into Tailwind. Four themes switch through `html[data-theme]`. Shared components live in `src/components/kit.tsx` and `kit-extra.tsx`.

**Demo data layers (all client-side, saved in the browser).**
- `src/lib/session.ts`: users, login, one-time code 123456, password Demo1234!, demo mailbox, demo toggles (failed payments, time travel). Personas: Maria (seller), Daniel (buyer), Sam (admin).
- `src/lib/demo-store.tsx`: deals, deal details, cars added in the demo, and every deal action (offer, counter, sign, pay, close, installments).
- Smaller stores: notifications, test drives and availability, ads, drafts, saved cars, autopay, inbox read state.
- `src/lib/finance.ts`: pure money math (down payment, fee, schedule, state interest caps).
- `src/lib/admin-data.ts` and `admin-seed.ts`: admin model built from the stores above plus saved admin decisions (suspensions, review results, notes, refunds, settings, audit log).

**Screens.**
- Public and auth: `src/routes/index.tsx`, `cars.*`, `auth.*`.
- Portals: `src/components/app/PortalShell.tsx` (seller and buyer) and `src/components/admin/AdminShell.tsx` (admin) provide the sidebar, top bar, mobile nav and role guards. Each role has its own routes (`seller.*`, `buyer.*`, `admin.*`).
- Deal Room: `src/components/app/DealRoom.tsx`, shared by `/deals/$id` and `/admin/deals/$id`.
- Admin helpers: `src/components/admin/kit.tsx` (tables, filters in the URL, confirm dialogs) and `charts.tsx`.

**How actions flow.** A button calls a store action, the store updates and saves, every screen re-renders from it, and a notification or audit entry is added where needed. For example, an admin cancelling a deal changes the same deal the seller and buyer see.

## Run it
```bash
npm install
npm run dev -- --port 8080
```
Sign in with `seller@demo.com`, `buyer@demo.com` or `admin@demo.com` (password `Demo1234!`, code `123456`). The demo toolbar at the bottom switches personas, advances a deal, and resets the demo.

Checks: `npx tsc --noEmit -p .`, `npm run build`, `npx vitest run`.

## Related files
- `WORK_DONE.md`: what changed from the start to now
- `CHECKLIST.md`: what is done and what is open
- `roadmap.md`: planned work
