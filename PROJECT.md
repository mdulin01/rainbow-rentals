# Rainbow Rentals

## Overview
Solo-operator rental management app: who has paid rent, texting tenants (reminders and replies), expenses, a monthly P&L, leases, documents, and a to-do list. Built to replace Avail for rent collection and tenant communication; rent is paid by Zelle.

- **Domain**: rainbowrentals.app
- **GitHub**: github.com/mdulin01/rainbow-rentals (branch: main — Vercel deploys from it)
- **Vercel Project**: rainbow-rentals
- **Firebase Project**: rainbow-rentals (Auth: Google, Firestore, Storage)

## Tech Stack
React 18 + Vite + Tailwind CSS. Firebase Auth (Google allowlist in `src/constants.js`), Firestore, Firebase Storage. Vercel for hosting plus serverless functions in `api/` (Twilio SMS send / inbound webhook / delivery status, daily cron). Claude API triages inbound tenant texts (suggests a reply; a human always sends).

## Architecture
- `src/rainbow-rentals.jsx` — main component: auth, Firestore subscriptions, navigation (`SECTIONS` + `goTo`), the Home tab and the P&L table, all modals.
- `src/rentLogic.js` — pure rent/lease logic (no React/Firebase/browser); shared with `api/`. Rent rows, auto-reminder schedule, lease state, paste-in tenant parsing.
- `src/utils.js` — formatting, dates, messaging links, templates.
- `src/hooks/` — one hook per Firestore doc: useProperties, useRent, useExpenses, useDocuments, useOwnership, useSharedHub.
- `src/components/` — by feature: Tenants (RentDay, ReminderComposer, TenantsList), Rent (RentLedger, RentReconciliation, AddRentPaymentModal), Rentals (PropertyCard/Detail, NewPropertyModal, TenantModal, SellVsHold), Expenses (ExpensesList, AddExpenseModal, CardInbox), Ownership, Documents, SharedHub (tasks), Checklists.
- `api/_lib/` — firebase-admin, Firestore helpers (transactional comms log, weekly backup), Twilio, triage.
- `firestore.rules` / `storage.rules` — managers (Mike, Liam) read/write; Adam read-only on his property.

## Tabs
Home (Rent Day, lease alerts, to-dos, checklists, card charges, expense review, More: this-week digest / export / recently deleted) · Properties · Tenants · Expenses · Money (P&L / Rent grid / Ledger) · Ownership · Documents. The phone dock shows the first five.

## Firestore layout
`rentalData/{properties, rent, expenses, comms, incomeActuals, cardInbox, expenseReview, activity, trash, backupMeta, backup-YYYY-MM-DD}`, `pushTokens/{uid}`, `rupert/note`.

## Operations
- Read-only Monday digest: `GET /api/digest`, protected by server-side `DIGEST_SECRET`; setup, response semantics and checks in [docs/digest-endpoint.md](docs/digest-endpoint.md).
- Setup for texting: `docs/twilio-setup.md` (Twilio env vars, A2P 10DLC registration, `CRON_SECRET`, `ANTHROPIC_API_KEY`).
- Daily cron 14:00 UTC (`vercel.json`): sends scheduled reminders when enabled under Rent Day ⚙️, and writes the weekly Firestore snapshot.
- Help page for the operator: `public/help.html` (linked from the app header).

## Dev
```bash
npm run dev      # Dev server
npm run lint     # ESLint (src + api)
npm run build    # Production build
```
Deploy = push to `main`.
