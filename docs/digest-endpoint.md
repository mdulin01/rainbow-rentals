# Read-only rentals digest

`GET /api/digest` is a server-to-server summary for the Monday rentals digest.
It reads Firestore through the existing server Firebase helper. It never writes,
sends messages, runs a backup, or creates portal tokens.

## Authentication and configuration

In **Vercel → rainbow-rentals → Settings → Environment Variables**, Mike adds:

| Name | Environment | Sensitive |
| --- | --- | --- |
| `DIGEST_SECRET` | Production | Yes |

Generate a new value locally with `openssl rand -hex 32 | pbcopy` and paste it
straight into Vercel settings. Use a separate value for each rental project.
Never put a value in chat, source, docs, or a PR. The scheduled task receives it
through that task's environment settings. The existing server-side
`FIREBASE_SERVICE_ACCOUNT` configuration is still required for authenticated reads.

The caller sends `Authorization: Bearer <DIGEST_SECRET>`. Missing, empty, or wrong
configuration/header returns **401 with an empty body**, before Firestore is read.
Per the vault's endpoint spec, **all non-GET methods also return empty 401** (the
handoff summary's 405 is superseded by that spec). Every response has
`Cache-Control: no-store`. Read failures return empty 500 and log only a fixed
error label, never the exception or request data.

After review and a separately authorized production deployment, this unsigned
request must print `401`:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://rainbowrentals.app/api/digest
```

The draft branch `codex/digest-endpoint` has automatic Git deployments disabled
in `vercel.json` using [Vercel's branch configuration](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentEnabled).
This keeps the PR review local; merging/releasing requires separate authorization.
Adding this endpoint does not configure or run the Monday scheduled task.

## Time, rent and privacy

- `asOf` is a calendar date in `America/New_York`, independent of the server timezone.
  ISO timestamps retain their timezone/instant; date-only records are local dates.
- `rentDue` is the current month's obligation. `rentReceivedThisMonth` is **cash
  received this calendar month**, based on `datePaid`, even if allocated to another
  rent month. Prepaid rent can therefore be `paid` with zero cash received this month.
  Future-dated receipts are excluded.
- Status uses current **rent-month** credits: `paid` when settled (including an
  explicitly paid ledger row), `late` for any balance after grace, `partial` when
  some rent has been paid but a balance remains before grace ends, and `unpaid`
  when nothing has been paid before the due date or through the grace period.
  `vacant` covers vacant, listed, renovating, and future/former households.
  Missing rent tracking uses `null` where the obligation/status is unknown.
- `daysLate` is calendar days since the contractual due date, but only once grace
  has ended; otherwise zero (`null` for unknown Dulin rent status).
- Only the first current tenant's first name is returned. Former/future tenant
  names are omitted. Property rows contain only `name`, `tenant`, `rentDue`,
  `rentReceivedThisMonth`, `status`, `daysLate`, and `leaseEnds`.
- `leaseEnds` is the earliest valid current lease end; `leasesEndingWithin90Days`
  includes today through day 90, excluding explicit month-to-month and vacant
  properties. No tenant identity is included in that list.
- Phone numbers, email addresses, message bodies, AI summaries/replies, portal
  tokens, payment instructions/Zelle details, and full tenant names are never
  projected into the response. These rules also apply to error responses.

## Rainbow response

```json
{
  "asOf": "2026-11-03",
  "properties": [
    {"name": "Sample home", "tenant": "Avery", "rentDue": 1500, "rentReceivedThisMonth": 1500, "status": "paid", "daysLate": 0, "leaseEnds": "2027-01-31"}
  ],
  "openThreads": [{"property": "Sample home", "lastInboundAt": "2026-11-02T05:00:00.000Z", "awaitingReplyHours": 36, "topic": "maintenance"}],
  "leasesEndingWithin90Days": ["Sample home 2027-01-31"],
  "expensesAwaitingReview": 3,
  "cardInboxUnmatched": 2,
  "lastBackup": "2026-11-01T14:00:00.000Z",
  "remindersSentLast7Days": 4
}
```

Reads `rentalData/{properties,rent,comms}` through `loadAll`, plus `expenseReview`,
`cardInbox`, and `backupMeta`. Rent due (including move-in proration), settlement,
and grace use the existing pure `src/rentLogic.js`; no separate balance engine.

`openThreads` uses the newest inbound per property/tenant in the existing capped
comms log. A later non-failed human reply, portal auto-reply, or `repliedAt` closes
it; a scheduled reminder does not. Unknown property IDs and future entries are
omitted. `awaitingReplyHours` is whole elapsed hours. Topics are limited to
`paid`, `will_pay`, `partial`, `question`, `maintenance`, `dispute`, `stop`, `start`,
or `other`; unrecognized triage values become `other`.

`expensesAwaitingReview` counts pending review items. `cardInboxUnmatched` counts
current inbox items excluding dismissed transaction IDs. `lastBackup` is the
normalized ISO instant from `backupMeta.lastAt`, or null. Reminders count outgoing
Twilio rent reminders with delivery `sent`, `delivered`, or `read` in the last
168 hours (inclusive); queued/failed sends, receipts and phone-app links do not count.

## Local verification

Synthetic fixtures only; no live credentials or Firestore access:

```sh
TZ=UTC npm run test:digest
TZ=Pacific/Honolulu npm run test:digest
npm run test:api
npm run build
npm run lint
git diff --check
```

The tests cover authentication before any reads, non-GET behavior, exact privacy
projection, cash versus rent-month settlement, Eastern summer/winter/DST and
grace boundaries, vacancy, lease windows, review queues and reminder/reply rules.
The loader is tested with a read-only store that has no mutation methods.
