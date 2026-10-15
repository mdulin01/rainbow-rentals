# Rainbow Rentals — Project Guidelines

## Key URLs & Resources

| Resource | URL |
|----------|-----|
| **Live Site** | https://rainbowrentals.app |
| **GitHub Repository** | https://github.com/mdulin01/rainbow-rentals |
| **Firebase Console** | https://console.firebase.google.com/project/rainbow-rentals |
| **Vercel Dashboard** | https://vercel.com/dashboard |

## Technical Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend/Database:** Firebase (Firestore, Authentication, Storage)
- **Deployment:** Vercel
- **Version Control:** GitHub (mdulin01/rainbow-rentals)

## Infrastructure

- **Firebase Project ID:** rainbow-rentals
- **Firebase Storage Bucket:** `gs://rainbow-rentals.firebasestorage.app`
- **Database:** Firestore
- **Authentication:** Enabled
- **Storage:** Enabled
- **Firebase config** is hardcoded in `src/firebase-config.js` (public API keys only)

## Architecture Notes

- **Main component:** `src/rainbow-rentals.jsx`
- **Shared utility:** `src/utils.js`
- **Key component groups:** Rentals, Expenses, Rent (RentLedger, RentReconciliation, AddRentPaymentModal — the Money tab's three views, plus the P&L table inline in the main component), Tenants (TenantsList, RentDay, ReminderComposer), Ownership, SharedHub (tasks + checklists), Documents
- **Navigation:** `SECTIONS` at the top of `src/rainbow-rentals.jsx` is the single list of tabs (dock flag = phone dock); all navigation goes through `goTo(id, opts)`; `?section=<id>` deep-links (aliases `rentday`, `analysis`, `pnl|grid|ledger`).
- **Backups:** the daily cron (`api/cron/reminders.js`) writes a weekly snapshot to `rentalData/backup-YYYY-MM-DD` (keeps 8) via `weeklyBackup()` in `api/_lib/data.js`.
- **Tenant comms:** `rentalData/comms` holds reminder settings (Zelle instructions, default due day/grace/late fee, Twilio + auto-schedule flags) and the message log. Two send paths: `sms:`/`mailto:` links from the operator's phone, or Twilio via the Vercel functions in `api/` (send, inbound webhook, delivery status, daily reminder cron). Setup: `docs/twilio-setup.md`.
- **Tenant portal:** `/t/<token>` → `api/portal/[token].js` (rewrite in `vercel.json`) renders a read-only balance/lease page from `tenantPortalData()` in `rentLogic.js`; the token lives on the tenant record (`portalToken`), minted by the app on first text (`ensurePortalToken` in the main component) or by the cron/inbound webhook (`ensurePortalToken` in `api/_lib/data.js`). Reminder templates include it via `{portalLine}`.
- **Shared rent logic:** `src/rentLogic.js` is pure (no React/Firebase/browser) and is imported by both the app and `api/` — keep it that way.
- **Custom hooks:** useDocuments, useExpenses, useOwnership, useProperties, useRent, useSharedHub
- **Context:** SharedHubContext
- This project shares a similar structure with `dulinproperties` but they are **completely separate** — separate Firebase projects, separate repos, separate domains, separate Vercel deployments.

## File Scope Boundary

**CRITICAL: When working on this project, ONLY access files within the `rainbow-rentals/` directory.** Do not read, write, or reference files from any sibling project folder (dulinproperties, lifedesigncourse, downtownGSO, etc.). If you need something from another project, stop and ask first.
