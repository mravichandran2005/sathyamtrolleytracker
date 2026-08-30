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

## What's new in this version

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
