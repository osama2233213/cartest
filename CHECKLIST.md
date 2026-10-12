# Checklist

`[x]` = done and checked. `[ ]` = not done, or written but not yet clicked through.

## Foundation
- [x] Reference theme tokens, fonts and 4 switchable themes
- [x] Shared UI kit (buttons, forms, modals, tables, toasts, stepper, calendar)
- [x] Client-side demo session (users, codes, mailbox, personas, demo toolbar)

## Public + Auth
- [x] Landing page
- [x] Car browse and car detail (gating, Ask and Test drive modals)
- [x] Offer page
- [x] Signup with role picker, login, verify code, 2-step for admin
- [x] Forgot/reset password, suspended page, demo inbox, no-access page

## Portal shell
- [x] Dark sidebar, top bar with search, notifications, account menu
- [x] Mobile tab bar and More sheet
- [x] Route guards by role

## Seller
- [x] Home
- [x] Vehicles: list, add-car wizard, detail, advertise
- [x] Inbox, deals, default options
- [x] Test drives and availability
- [x] Payments, notifications
- [x] Onboarding (identity, payouts)
- [x] Account

## Buyer
- [x] Home, verification steps
- [x] Saved cars, inbox
- [x] Deals, payoff
- [x] Test drives
- [x] Payments (autopay, receipts)
- [x] Notifications, account

## Deal Room
- [x] Header, 10-step stepper, "Your next step" banner
- [x] Per-stage actions (seller and buyer)
- [x] Risk summary, numbers, people, documents, chat
- [x] Shared with admin (read-only view)
- [x] Every stage and modal clicked through as both seller and buyer

## Admin
- [x] Shell and navigation (5 groups, mobile menu)
- [x] Dashboard
- [x] Verifications (approve clicked through)
- [x] Verifications: reject, request info, bulk approve clicked through
- [x] Users and user detail
- [x] Suspend, reinstate, reset 2-step, View as clicked through
- [x] Vehicles and vehicle detail
- [x] Approve, take down, flag actions clicked through
- [x] Deals board/table and admin deal page
- [x] Pause, escalate, cancel, mark default clicked through
- [x] Test drives, closed deals (CSV)
- [x] Revenue, payments
- [x] Refund and dispute actions clicked through
- [x] Advertising and partner detail
- [x] Integrations and detail
- [x] Settings: fees, state rules, policies, team
- [x] Settings saves clicked through
- [x] Audit log, support, notifications, account
- [x] Support reply/solve clicked through

## Quality
- [x] `tsc` clean
- [x] `npm run build` passes
- [x] 87 vitest tests pass
- [x] Tests for revenue reconciliation (admin actions were verified by hand in the browser, not unit tested)
- [x] Layout check at phone width for admin pages

## Remaining roadmap
- [x] Full notification seed data
- [ ] Mock vendor adapters
- [ ] Replace invented admin data with real data where it exists (revenue now comes from the ledger; partners, tickets and integrations are still mock)
- [x] Make revenue totals match the fee ledger rows
