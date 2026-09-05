# Trolley Tracker — Sathyam Auto

A web app that replaces the WhatsApp + Excel process for tracking trolleys/bins
sent out with deliveries and returned by customer/supplier companies.

**How it works:** whoever *sends* a batch of trolleys logs a dispatch entry.
Whoever *receives* it must acknowledge what actually arrived before the
numbers count as official — if the confirmed count doesn't match what was
declared, that specific transaction is automatically flagged as a mismatch
and sent to the Master to review. Only your own staff can acknowledge your
own incoming counts, and only a partner's own staff can acknowledge theirs —
so neither side can quietly rewrite what the other received.

---

## ⚠️ One more update — self-reported returns (run this too)

Run `supabase/migration_7_self_reported_returns.sql` — additive. Lets My
Company staff log a return directly (marked "Self-reported" everywhere it
shows up) for cases where a partner physically sent trolleys back without
using the app at all.

## ⚠️ One more update — push notifications (run + deploy this too)

1. Run `supabase/migration_6_push_notifications.sql` — additive.
2. Deploy the notification function:
   ```bash
   supabase functions deploy notify-pending
   ```
3. Set these three secrets for that function (these are the VAPID keys —
   already generated for you below; you can use them as-is, or generate your
   own with `npx web-push generate-vapid-keys` if you'd rather):
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=BIk1ds7R85W5SKYWrFTthRd8RSx6IeGZERNoTNIXGrGW_Gp-IeMZJOowqoE_BQ1RFUBksob80OVGsIadrnC6ll8
   supabase secrets set VAPID_PRIVATE_KEY=WMVdsgaeHc47JsAQ3OfZILs9WVHkXJ0rxxt7GxjFDsk
   supabase secrets set VAPID_SUBJECT=mailto:you@sathyamauto.com
   ```
   **The private key must stay secret** — never put it in `.env` or anywhere
   the browser can see it. It only belongs in this Edge Function secret.
4. Add the **public** key to your frontend env — it's already in
   `.env.example`. Add `VITE_VAPID_PUBLIC_KEY` to your Vercel project's
   environment variables too (same value), then redeploy.

**How it works:** each user gets a dismissible banner offering to "Enable
notifications" the first time they visit (browser asks permission once).
The moment someone logs a dispatch or a return, the app pings the
`notify-pending` function, which figures out exactly who needs to confirm it
(the specific partner company's staff, or all of your own staff) and pushes
a real phone/browser notification to everyone who's enabled it.

**Two real limitations worth knowing:**
- **iPhones**: Safari only supports push notifications for sites that have
  been "Added to Home Screen" first (iOS 16.4+) — a plain browser tab won't
  get them on iPhone. Android and desktop browsers work normally, no extra
  step needed.
- If the Edge Function call fails for some reason (a network blip right as
  someone submits), that one notification is just silently skipped — it
  never blocks or fails the actual dispatch/return itself.

## ⚠️ One more update — names, per-company stock visibility, editable opening stock

Run `supabase/migration_5_names_and_scoping.sql` — additive. This also
tightens who can see what: partner company logins now only ever see their
own company's stock figures, never another partner's (previously stock
tables were readable by anyone logged in, just not shown in the UI).

## ⚠️ One more update — password reset & security (run + deploy this too)

1. Run `supabase/migration_4_password_reset.sql` in the SQL Editor — additive.
2. Deploy the Edge Function that lets Master issue temporary passwords (this
   is the one piece that needs the Supabase CLI, since it's the only safe
   place to use Supabase's admin privileges):
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF   # find this in your Supabase project URL
   supabase functions deploy reset-password
   ```
   That's it — the function automatically has access to your project's URL
   and keys, nothing else to configure.

**How password reset works now (no email involved):** a user clicks "Forgot
password?" on the login screen and enters their email. That flags their
account in the Users tab with a **"Reset requested"** badge. Master clicks
**Reset password** next to their name, which generates a temporary password
(shown once, in a box you copy and share privately — by phone, WhatsApp, in
person). The user logs in with that temporary password, and the app
immediately forces them to set their own permanent password before they can
do anything else. The temporary one stops working the moment they do.

## ⚠️ One more update — period tracking (fixes a real bug, run this too)

Run `supabase/migration_3_period_tracking.sql` once — additive, nothing is
wiped. This fixes a real problem: previously the app used *today's calendar
date* to decide "the current month," so if you were late closing a month,
the moment the calendar rolled over your still-open data would quietly
vanish from the dashboard. Now the app tracks its own "current period"
internally, which only advances when Master actually clicks Close — you can
close whenever you're ready, on the 1st or the 25th, and nothing is ever
dropped by waiting.

## ⚠️ One more update — your own inventory (run this too)

A new additive migration adds tracking for **your own company's** stock,
alongside each partner's. Unlike the schema.sql upgrade, this one does
**not** wipe anything — just run `supabase/migration_2_my_company_inventory.sql`
once in the SQL Editor on top of whatever you already have.

## ⚠️ You're upgrading from the first version — re-run the schema

This version switches companies / trolley types / vehicles from random UUIDs
to plain sequential numbers (1, 2, 3…), and adds vehicles, opening stock,
and monthly close-out. `supabase/schema.sql` now **drops and recreates every
table** at the top of the file — safe since you haven't onboarded real users
or logged real transactions yet.

1. Supabase → **SQL Editor → New query** → paste the *entire* new
   `supabase/schema.sql` → **Run**.
2. You'll need to redo the "make yourself Master" step (below) since the
   `profiles` table was recreated.
3. If you already had companies / trolley types added, re-add them from the
   Master dashboard afterwards — they were reset too.

## 1. Set up Supabase

Same as before: create a project, run `supabase/schema.sql`, grab your
**Project URL** and **anon public key** from Settings → API, and under
Authentication turn **off "Confirm email"** (recommended — avoids the
sign-up rate-limit error, since your own approval step in the Users tab is
already the real access gate).

## 2. Make yourself Master

Sign up in the running app with your own email, then in the SQL Editor:

```sql
update profiles set role = 'master'
where id = (select id from auth.users where email = 'you@yourcompany.com');
```

## 3. Run it locally

```bash
npm install
cp .env.example .env
# edit .env with your Supabase URL + anon key
npm run dev
```

## 4. Deploy to Netlify

Push to GitHub → Netlify → Import project → build command `npm run build`,
publish directory `dist` (already set in `netlify.toml`) → add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables →
Deploy.

---

## Branding — Sathyam Auto

Open `src/brand.js`. It controls the company name shown everywhere and the
role labels ("My Company Employee" / "Partner Employee"):

```js
export const BRAND_NAME = 'Sathyam Auto'
export const LOGO_PATH = null // set to '/logo.png' once you add the file
```

**To add your logo:** drop your logo image into the `public/` folder as
`logo.png` (any reasonable size, square works best — e.g. 128×128), then in
`src/brand.js` change `LOGO_PATH` from `null` to `'/logo.png'`. It'll replace
the placeholder mark in the header and login screen automatically.

**To add a favicon** (the small icon shown in the browser tab): drop a
square image into the `public/` folder named exactly `favicon.png` — 32×32
or 64×64px works well, PNG is easiest (a proper multi-size `.ico` also works
if you rename the file and the link in `index.html` to match). No code
change needed — `index.html` already points at `/favicon.png`, so once the
file exists there it'll just show up, both locally and after you deploy.

## What's new in this version

- **Fixed a real timezone bug** in month/period tracking that could silently
  write the wrong date for opening stock and the tracked period, for anyone
  outside UTC. If you hit this before this version, see the recovery notes
  from that conversation — the fix itself is just in the code now.
- **My Company can self-report a return** — for when a partner sends
  trolleys back without using the app. Clearly tagged "Self-reported"
  everywhere it appears, since it isn't cross-confirmed like normal entries.
- **Month close now exports the actual inventory table** (opening/
  dispatched/returned/closing per company), not the raw transaction list —
  that's still available separately from the Transactions tab's own export.
- **Fixed Overview not refreshing after setting opening stock** — it was
  silently showing stale numbers until a manual page reload; now it updates
  immediately.
- **Push notifications** — see the migration note above. Users can enable
  browser/phone notifications; they're pinged automatically whenever a
  transaction needs their confirmation.
- **Every transaction now shows who sent it and who acknowledged it.**
  Visible to everyone who can see that transaction at all — no separate
  permission needed.
- **Everyone sees their own stock.** Partner company staff now see a "with
  us" figure per trolley type right on their dashboard — just their own
  company's numbers, never another partner's. Your own staff see the same
  "our stock" figures Master sees.
- **Opening stock can be set or corrected at any time**, not just at
  month-end — Month close tab → "Set opening stock" section. This is the
  fix for stock numbers reading negative before an opening baseline exists.
- **Password reset without email** — see the migration note above. Master
  issues temporary passwords from the Users tab; users are forced to set
  their own on first login with one.
- **Password fields have a show/hide eye icon** everywhere they appear.
- **Closing a month now requires typing CLOSE to confirm**, and tells you
  exactly how many transactions will be permanently deleted first.
- **Your own company's inventory is now tracked too** — not just each
  partner's. Master sets an opening stock for your own warehouse each month
  (Month close tab), and it's automatically adjusted by every dispatch
  (decreases it) and every return (increases it), same as partner stock.
  Shown as KPI cards per trolley type at the top of the Overview tab, and as
  a chart on the Charts tab. Only Master and your own staff can see it —
  partner company logins never see your internal numbers.
- **Master can edit or delete any transaction** — Transactions tab → Edit
  on any row. Editing recalculates its status automatically from the
  quantities you enter.
- **Vehicle tracking** — Master tab "Vehicles" (add your ~5-6 vehicle
  numbers once). Every dispatch/return now requires picking one, and it
  shows on every transaction row.
- **Deactivate users** instead of deleting them — Users tab → Deactivate.
  Blocks their login instantly but keeps their name on old transactions so
  history still reads correctly. Reactivate any time.
- **Monthly opening stock + close-out** — Master tab "Month close". Shows
  each company/type's opening stock, this month's dispatches/returns, and a
  suggested closing figure you can adjust to match your physical count.
  Export first (button included right there), then click **Close month**:
  this purges the month's confirmed transactions (pending ones carry over
  untouched) and sets next month's opening stock automatically. A small
  summary row per company/type is kept permanently in `monthly_summary` so
  your charts still show history even after transactions are purged.
- **Excel export** — available on the Transactions tab and the Month close
  tab. Downloads an `.xlsx` with one row per transaction, vehicle, and
  sent/received quantities per trolley type.
- **Reports now show exactly what mismatched** — e.g. "Box trolley: declared
  5 → confirmed 3" — not just a generic mismatch message.
- **Charts tab** — stock currently with each company, and this month's
  dispatched/returned/mismatch volumes per company.
- **The acknowledge button now always says "Acknowledge"** — whether or not
  the count matches, that's the action; a mismatch just additionally raises
  a report to the Master behind the scenes.

## Day-to-day use

- **First-time setup each month:** Master sets that month's opening stock
  for each company/type from a physical count (Month close tab — if none is
  set yet, the Overview tab assumes 0 and tells you so).
- **Sending a delivery:** My Company staff → *Log a dispatch* → pick
  company, vehicle, quantities.
- **Receiving it:** any of that partner's registered staff sees it under
  *To confirm*, and acknowledges what actually arrived.
- **Sending trolleys back:** partner staff → *Log a return*, same way.
- **Month end:** Master exports the Excel, reviews/adjusts the Month close
  screen, clicks Close.

## Notes / possible next steps

- There's still no WhatsApp/email notification when something needs
  confirming — staff check the *To confirm* tab. Can be added later with a
  Supabase Edge Function.
- Master account creation is still self-signup + approval, not
  Master-assigns-a-password. That needs a small serverless function holding
  an admin key safely on Supabase's side — let me know if you want that
  built next.
