# Founding waitlist ops

Supabase project: **Paperview** (`wpvfaistmwtkgkqpkkrm`, `eu-west-1`).

**Invite a friend + Vercel deploy walkthrough:** [`invite-tryout-deploy.md`](invite-tryout-deploy.md) (start here for getpaperview.com).

## Export emails (admin)

In the Supabase SQL editor:

```sql
-- All accounts
select email, founding, founder_number, launch_grant_status, created_at
from public.profiles
order by created_at;

-- Founders only (promised €2 grant)
select email, founder_number, launch_grant_status, created_at
from public.profiles
where founding = true
order by founder_number;
```

Or Table Editor → `profiles` → Export CSV.

## Auth redirect URLs

Dashboard → **Authentication** → **URL Configuration**:

| Field | Value |
|---|---|
| **Site URL** (local) | `http://localhost:5173` |
| **Site URL** (prod) | `https://getpaperview.com` |

**Redirect URLs** allow list (add all that apply):

```text
http://localhost:5173/**
http://localhost:5173/welcome
http://localhost:5173/welcome/**
https://YOUR-PRODUCTION-DOMAIN/**
https://YOUR-PRODUCTION-DOMAIN/welcome
https://YOUR-PRODUCTION-DOMAIN/welcome/**
```

Magic / confirm links use `emailRedirectTo = ${origin}/welcome` (dedicated thank-you page).

## Email rate limit (“email rate limit exceeded”)

Supabase’s **built-in** mailer is capped (especially on free tier). After a few magic links / confirmations you hit **email rate limit exceeded**.

**Yes — set up custom SMTP** for anything beyond light testing. Good cheap options: **Resend**, **Brevo**, **Postmark**, or your domain’s transactional mail.

Dashboard → **Project Settings** → **Authentication** → **SMTP Settings** (or **Authentication** → **Emails** → SMTP, depending on UI):

1. Enable custom SMTP
2. Host / port / user / password from your provider
3. Sender: e.g. `noreply@yourdomain.com` (must be verified at the provider)
4. Save, then send a test magic link

Until SMTP is on, wait for the rate-limit window to reset (often ~1 hour) or use a different test inbox sparingly.

## Clear founding test users (reset spots to 100)

**Option A — Dashboard (simplest)**  
**Authentication** → **Users** → open the user → **Delete user**.  
That cascades to `profiles` / `wallets` / etc. Spots-left returns toward 100.

**Option B — SQL editor** (service role / dashboard SQL):

```sql
-- Wipe all auth users (cascades to profiles, wallets, ledger, purchases)
delete from auth.users;
```

Also clear the browser session: sign out on the site, or DevTools → Application → Local Storage / clear site data for localhost, so an old session doesn’t stick.

## Branded auth emails

Templates live in [`docs/email-templates/`](email-templates/):

1. Dashboard → **Authentication** → **Email Templates**
2. **Confirm signup**
   - Subject: `Confirm your Paperview founding spot`
   - Body: paste [`confirm-signup.html`](email-templates/confirm-signup.html) (keep `{{ .ConfirmationURL }}`)
3. **Magic Link**
   - Subject: `Your Paperview sign-in link`
   - Body: paste [`magic-link.html`](email-templates/magic-link.html)

No custom SMTP required for branding; add SMTP later only if deliverability is weak.

## Invite emails (tryout €2 now)

Money unit: **1 EUR = 100_000_000 microcents** → €2 grant = `200000000`; chat/explain = `2000000` (€0.02) per user question; agent = `10000000` (€0.10) per send. Tool-loop continuations are not re-billed.

Pre-register a friend (SQL editor / service role):

```sql
insert into public.invite_emails (email, note)
values ('friend@example.com', 'family tryout')
on conflict (email) do update
set active = true,
    note = excluded.note,
    claimed_by = null,
    claimed_at = null;
```

They sign up with **that same email** via the founding magic link. `/welcome` calls `claim_tryout_grant()` and credits the wallet.

Backup: create **one-time** invite codes via SQL (`max_redemptions = 1`). Shared `TRY-PAPERVIEW` is disabled — prefer `invite_emails`. See [`invite-tryout-deploy.md`](invite-tryout-deploy.md).

Server env for hosted debit (Vercel + local `.env.local`):

```env
OPENAI_API_KEY=...
SUPABASE_URL=https://….supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## When to build paid packs (Stripe)

Start paid top-ups when:

- 100 founding spots are filled, **or**
- founders + waitlist ≥ ~150–200, **or**
- clear repeated “I won’t paste an API key” feedback

Then: wire Stripe packs (`eur3` / `eur5` / `eur10`) on top of the existing wallet ledger.