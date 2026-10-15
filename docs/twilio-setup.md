# Texting tenants through Twilio — setup checklist

The app can send rent reminders from your own phone (no setup) or through a Twilio
number (server-side: automatic schedule, replies land in the app, AI triage). This is the
one-time setup for the Twilio path. Nothing here is needed for the "My phone" button.

## 1. Twilio account

- You already have one: **"My first Twilio account"** (`AC316c…744f`, mdulin@gmail.com).
  Twilio flagged it **dormant on 2026-09-10** and will rotate the auth token ~90 days later
  (early December). Log in at https://console.twilio.com and click **Restore** on the banner.
- It is still a **trial** account unless you've added payment: trials can only text
  *verified* numbers and prefix every message with "Sent from your Twilio trial account".
  **Upgrade** (Billing → add a card, $20 is plenty; texts are ~$0.008 each).
- Buy a **local Greensboro number** (Phone Numbers → Buy → area code 336, SMS-capable).
  Tenants reply to local numbers far more than toll-free ones.

## 2. A2P 10DLC registration (required for US texting from a local number)

Carriers block unregistered application traffic. Two options:

| Option | For | Cost | Time | Limit |
|---|---|---|---|---|
| **Sole Proprietor** | an individual with no EIN | ~$4 one-time + $2/mo | a few days | 1,000 segments/day — plenty |
| **Low-volume Standard** | an LLC with an EIN (e.g. Rainbow Rentals LLC) | ~$4 + $15 one-time + $1.50–$10/mo | 1–3 weeks | 2,000/day |

Console → Messaging → Regulatory Compliance → A2P 10DLC → **Create brand**, then
**Create campaign** with use case "Mixed" or "Account Notifications". Sample messages
(paste these; the carriers want to see what you'll send):

- `Hi Haley, friendly reminder that October rent of $1,450 for 622 N. Elm is due Oct 1. Please pay by Zelle to 336-xxx-xxxx. Thanks! – Mike`
- `Hi Haley, we have not received October rent of $1,450 for 622 N. Elm, which was due Oct 1. A $50 late fee applies after the 5-day grace period. Please send it today and reply to let us know. – Mike`

Opt-in description: "Tenants provide their mobile number on the lease application and
agree in the lease to receive rent and property notices by text. Reply STOP to opt out."
Create a **Messaging Service**, add the number to its sender pool, attach the campaign.

(If registration is a hassle, the alternative is a **toll-free** number with toll-free
verification — free, 1–2 weeks, no EIN needed — but local numbers get better replies.)

## 3. Webhooks (Messaging Service → Integration, or the phone number's config)

- **A message comes in** → `https://rainbowrentals.app/api/sms/inbound` (HTTP POST)
- Status callbacks are set per message by the app; nothing to configure.
- Keep Twilio's **Advanced Opt-Out** on (default) so STOP/START are handled by Twilio; the
  app also flips the tenant's "OK to text" flag when it sees them.

## 4. Firebase service account (lets the server read/write Firestore and send pushes)

Firebase console → Project settings → **Service accounts** → *Generate new private key*.
Keep the JSON; it goes into a Vercel env var below. Never commit it.

## 5. Vercel environment variables (Project → Settings → Environment Variables, all envs)

| Name | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | from the Twilio console home |
| `TWILIO_AUTH_TOKEN` | same place (rotate it after restoring the dormant account) |
| `TWILIO_MESSAGING_SERVICE_SID` | `MG…` from step 2 (preferred) — or `TWILIO_FROM` = `+1336…` before registration |
| `PORTAL_CONTACT_PHONE` | Optional. Number shown on the tenant's balance page (`/t/<token>`) as "message us at…"; falls back to `TWILIO_FROM` |
| `FIREBASE_SERVICE_ACCOUNT` | the whole JSON from step 4 (paste as one line, or base64) |
| `CRON_SECRET` | any long random string; Vercel sends it on cron calls |
| `ANTHROPIC_API_KEY` | optional — enables the 🦚 triage of tenant replies (summary + suggested answer). Without it, replies still land in the app, just untriaged |
| `MANAGER_EMAILS` | optional, default `mdulin@gmail.com,dulinliam@gmail.com` — who may send |

Redeploy after adding them. The daily cron (`/api/cron/reminders`, 10:00 ET) is declared in
`vercel.json`; Vercel's Hobby plan allows one daily run, which is all this needs.

## 6. Turn it on in the app

Home → 📣 Rent Day → ⚙️:
1. Payment instructions + sign-off name.
2. ☑ **Send texts through Twilio**. The composer's main button becomes "Send text";
   "My phone" stays as a fallback.
3. ☑ **Automatic reminders** and pick the schedule (default: 3 days before, on the due
   day, 1 day after grace ends, then weekly).

Test: send yourself one from the composer (add yourself as a tenant on a test property or
temporarily put your number on a tenant), reply to it, and confirm it shows under
**💬 Replies** with a 🦚 summary. Dry-run the cron without sending:
`curl -H "Authorization: Bearer $CRON_SECRET" "https://rainbowrentals.app/api/cron/reminders?dry=1"`.

## What the AI does and does not do

- Reads each inbound text and files it as paid / will pay / partial / question /
  maintenance / dispute / stop / other, with a one-line summary and a suggested reply.
- **Never sends on its own.** You tap Reply, see the draft, edit, send. Scheduled reminders
  are fixed templates, not AI-written.
- Tenant texts are sent to Anthropic for classification. Keep that in mind if a lease or
  privacy notice promises otherwise.

## 7. Tenant balance page

Every reminder (manual or automatic) ends with a private link, `https://rainbowrentals.app/t/<token>`,
where the tenant sees this month's rent, what's paid, the balance, earlier months with no payment
recorded, how to pay, their lease terms and recent payments. No login: the token is a 128-bit secret
stored on the tenant record (`portalToken`), minted the first time you text them. Tenants can also
text **BALANCE**, **LINK** or **LEASE** to the Rainbow Rentals number and get the link back
automatically (the only automatic reply the app sends; it is logged in Rent Day like any other text).
To copy a tenant's link yourself: Tenants → 🔗 on their row. To revoke a link, clear `portalToken`
on the tenant in Firestore (a new one is minted on the next text).
