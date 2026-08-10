# Invite a friend + deploy tryout credits

Domain: **https://getpaperview.com**  
Branch: `cursor/founding-waitlist`  
Supabase project: **Paperview** (`wpvfaistmwtkgkqpkkrm`)

This guide assumes Resend DNS is verified and Supabase SMTP is already pointed at Resend.

---

## Part A — What you must do now (checklist)

### 1. Supabase Auth URLs

Dashboard → **Authentication** → **URL Configuration**

| Field | Value |
|---|---|
| **Site URL** | `https://getpaperview.com` |
| **Redirect URLs** | see list below |

Add every line:

```text
https://getpaperview.com/**
https://getpaperview.com/welcome
https://getpaperview.com/welcome/**
http://localhost:5173/**
http://localhost:5173/welcome
http://localhost:5173/welcome/**
```

### 2. Supabase SMTP (confirm)

Dashboard → **Project Settings** → **Authentication** → **SMTP**

| Setting | Value |
|---|---|
| Enable custom SMTP | on |
| Host | `smtp.resend.com` |
| Port | `465` (or `587` if Resend docs say so) |
| Username | `resend` |
| Password | Resend **API key** |
| Sender email | `noreply@getpaperview.com` |
| Sender name | `Paperview` |

Send yourself one magic link from the landing founding form to confirm mail arrives.

### 3. Branded email templates (recommended)

Dashboard → **Authentication** → **Email Templates**

- **Magic Link** — paste [`docs/email-templates/magic-link.html`](email-templates/magic-link.html) (keep `{{ .ConfirmationURL }}`)
- **Confirm signup** — paste [`docs/email-templates/confirm-signup.html`](email-templates/confirm-signup.html) if you use confirm flow

### 4. Environment variables

#### Local — `.env.local` (gitignored)

```env
# Browser (safe to expose with VITE_)
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_or_publishable_key
VITE_OPENAI_MODEL=gpt-5.4-mini
VITE_OPENAI_MODELS=gpt-5.4-nano,gpt-5.4-mini,gpt-5.4

# Server only — never use VITE_ for these
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Notes:

- `VITE_OPENAI_API_KEY` is optional and **not** for shared deploys (it ships in the browser bundle).
- `SUPABASE_SERVICE_ROLE_KEY` is required for wallet debit. Treat it like a root password.
- Keys: Supabase → **Project Settings** → **API**.

#### Vercel — Project → Settings → Environment Variables

Add the same keys for **Production** (and Preview if you want tryouts on preview URLs):

| Name | Environments | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Production (+ Preview) | Same as local |
| `VITE_SUPABASE_ANON_KEY` | Production (+ Preview) | Same as local |
| `VITE_OPENAI_MODEL` | Production | Optional |
| `VITE_OPENAI_MODELS` | Production | Optional |
| `OPENAI_API_KEY` | Production (+ Preview) | **Server only** — your key, billed to you |
| `OPENAI_WALLET_MODELS` | Production (+ Preview) | Optional; default `gpt-5.4-nano,gpt-5.4-mini` |
| `SUPABASE_URL` | Production (+ Preview) | Same URL as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Production (+ Preview) | **Server only** |

Do **not** set `VITE_OPENAI_API_KEY` on Vercel for the public site.

After changing env vars, **redeploy** (env is baked in at build for `VITE_*`).

### 5. Attach the domain on Vercel

1. Vercel → your Paperview project → **Settings** → **Domains**
2. Add `getpaperview.com` (and `www` if you want; redirect www → apex or the reverse)
3. In **Hostinger DNS**, point the domain at Vercel (A/CNAME records Vercel shows). Keep Resend’s SPF/DKIM records as well.
4. Wait until the domain shows **Valid** in Vercel.

### 6. Deploy the branch

From your machine (or merge when ready):

```bash
git checkout cursor/founding-waitlist
git push -u origin HEAD
```

Then either:

- Vercel: open the deployment for this branch and **Promote** to Production, or  
- Set Production branch to `cursor/founding-waitlist` until you merge to `main`, or  
- Merge to `main` once you’ve smoke-tested the preview URL.

Confirm:

- `https://getpaperview.com` loads the landing page  
- Founding form sends a magic link that opens `/welcome`  
- With server env set, chat can run on tryout credit (no personal key)

---

## Part B — Invite a friend (full walkthrough)

Friends do **not** need an invite code if you pre-register their email.

### Step 1 — You: add their email to the allowlist

Supabase → **SQL Editor** → New query:

```sql
insert into public.invite_emails (email, note)
values ('friend@example.com', 'family tryout')
on conflict (email) do update
set active = true,
    note = excluded.note,
    claimed_by = null,
    claimed_at = null;
```

Use their real address, lowercase is fine (`citext` matches case-insensitively).

Check:

```sql
select email, active, claimed_by, claimed_at, grant_microcents, note
from public.invite_emails
order by created_at desc;
```

€2 = `200000000` microcents (default).

### Step 2 — You: tell them what to do

Send something like:

> Go to https://getpaperview.com, scroll to founding signup, enter **this exact email**, and open the magic link we send you. You’ll get €2 of tryout credit (~100 questions). No API key needed.

### Step 3 — They: sign up

1. Open https://getpaperview.com  
2. Enter the **same** email in the founding / waitlist form  
3. Open the magic link from their inbox (from `noreply@getpaperview.com`)  
4. Land on `/welcome` — should say **€2.00 ready to try** (or similar)  
5. Click **Open Paperview**

They never type a code on this path.

### Step 4 — They: use the app

1. Pick a PDF folder (File System Access)  
2. Ask a question in chat **without** pasting an OpenAI key  
3. Sidebar footer shows **Credit · €x.xx** and drops by **€0.02** per chat/explain *question* (agent turns **€0.10**) — tool-loop rounds inside one question are included
4. When credit hits €0, Settings → paste their own key (BYOK fallback)

### Step 5 — You: confirm it worked

```sql
-- Invite claimed?
select email, claimed_by, claimed_at
from public.invite_emails
where email = 'friend@example.com';

-- Wallet balance
select w.user_id, w.balance_microcents, p.email, p.founding, p.launch_grant_status
from public.wallets w
join public.profiles p on p.user_id = w.user_id
where p.email ilike 'friend@example.com';

-- Recent ledger
select l.kind, l.amount_microcents, l.openai_cost_microcents, l.model, l.created_at
from public.ledger l
join public.profiles p on p.user_id = l.user_id
where p.email ilike 'friend@example.com'
order by l.created_at desc
limit 20;
```

Expect: `launch_grant_status = 'granted'`, a `grant` ledger row for `+200000000`, then `debit` rows of `-2000000` (chat) as they ask questions.

---

## Backup path — one-time invite codes

Prefer **email allowlist** (`invite_emails`). Shared public code `TRY-PAPERVIEW` is **disabled**.

Create a **one-time** code in SQL Editor when someone needs Settings → Redeem:

```sql
insert into public.invite_codes (code, grant_microcents, max_redemptions, note)
values ('FRIEND-ALICE', 200000000, 1, 'one-time for Alice');
```

- `max_redemptions = 1` → single use (schema requires `max_redemptions > 0`; use `active = false` to disable a code)
- €2 = `200000000` microcents
- Same user cannot stack email grant + code grant

Disable a code:

```sql
update public.invite_codes
set active = false
where upper(code) = 'FRIEND-ALICE';
```

List codes:

```sql
select code, active, max_redemptions, redemption_count, note, created_at
from public.invite_codes
order by created_at desc;
```

---

## Pricing reminder (hosted wallet)

| Action | Debit |
|---|---|
| Chat / explain | €0.02 per question (tool rounds included) |
| Agent turn | €0.10 per send (tool rounds included) |

€2 ≈ 100 chat questions. Wallet debit is **fixed per action** (not OpenAI × markup). The proxy reserves the debit **before** calling OpenAI and refunds if the model call fails. OpenAI token cost is stored on the ledger for your subsidy tracking only (actual usage × list rates in `openaiPricing.js`, USD≈EUR 1:1).

Hosted credit also enforces: **nano/mini models only** (override with `OPENAI_WALLET_MODELS`), **no streaming**, **max output tokens**, **payload size cap**, **per-user rate limit**, **agent pricing** for agent-shaped bodies, and **response-tier tracking** so an agent thread cannot be continued at chat price. Honest chat may still use `search_document` at chat price. Cross-user `previous_response_id` reuse is rejected.

BYOK users are not debited.


---

## Troubleshooting

| Symptom | Fix |
|---|---|
| No magic email | Check SMTP + Resend logs; spam folder; sender domain verified |
| Magic link opens wrong host / error | Auth redirect allow list must include that origin + `/welcome` |
| Welcome shows no €2 | Email not in `invite_emails`, or different address used; check SQL above |
| Chat asks for API key with credit | Missing `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` on Vercel; redeploy after adding |
| 402 / credit empty | Expected after spend; add BYOK or grant more via a new invite/code |
| Local works, prod doesn’t | `VITE_*` only apply after rebuild; confirm Production env vars |

---

## Related

- Day-to-day SQL / SMTP notes: [`founding-waitlist-ops.md`](founding-waitlist-ops.md)  
- Email HTML: [`email-templates/`](email-templates/)  
- Env template: [`.env.example`](../.env.example)
