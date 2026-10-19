# cred-update — Credential audit and recovery spec

**Branch:** `cred-update` · **Date:** 2026-10-18 · **App:** Serasomatic appointment CRM
**Production:** https://serasomatic.vercel.app (Vercel project `serasomatic`, team `sethrocks-projects`, deploys `main`)

---

## 1. Why this exists

The site renders, but it is functionally down. Every login returns HTTP 500 because the
production database points at a Neon endpoint that Replit provisioned when the app lived at
`scheduleing.replit.app`. That endpoint is not in our Neon account and now refuses
connections ("The endpoint has been disabled"). The old Replit URL returns 404.

While diagnosing that, the rest of the credential surface was checked. This document is the
single source of truth for:

1. every credential the application reads, where, and what breaks without it;
2. what is verified working, broken, missing, or dead weight as of 2026-10-18;
3. the recovery runbook, in order;
4. copy-paste **Dispatch prompts** for every step that needs a human-owned console
   (Replit, Neon, Google, Gmail, Anthropic, Vercel);
5. the database migration and cutover procedure;
6. the verification checklist;
7. the Phase 2 credential matrix for the Horizon chat gateway (documented, not provisioned).

Decisions already taken:

| Decision | Choice |
|---|---|
| Credential acquisition tool | **Claude Dispatch** (browser tasks on this Mac, approved from phone) |
| Database recovery | Revive the Replit-managed DB first, export, migrate into our own Neon project `seramangement`. Fallback: July 19 2026 backup (appointments only). |
| Google Drive | Out of scope (no Drive code exists) |
| Horizon chat gateway secrets | Phase 2, documented only |

---

## 2. Status at a glance (verified 2026-10-18, read-only checks)

| Area | Status | Evidence |
|---|---|---|
| Database (`DATABASE_URL`) | 🔴 **DOWN** | Neon: endpoint `ep-falling-scene-a4h6hlx0` disabled; prod `POST /api/auth/login` → 500 `Failed to log in` |
| Sessions / MFA (`SESSION_SECRET`) | 🟡 Set in Vercel, unverifiable until DB is back | `server/middleware/session.ts`, `server/services/totpService.ts:15` |
| Google Calendar (5 vars) | 🟢 **WORKING** | Refresh token mints access tokens; `calendars.get` resolves both calendars: "Scheduled-Rescheduled" (active) and "Complete-Cancel" (archive) |
| Gmail SMTP (`GMAIL_EMAIL`, `GMAIL_APP_PASSWORD`) | 🔴 **BROKEN** | `nodemailer.verify()` → `535-5.7.8 Username and Password not accepted` (app password revoked or 2-Step changed) |
| `NOTIFICATION_EMAIL` | 🔴 **MISSING** in Vercel and local `.env` | Default recipient for new/changed-appointment emails; without it only opted-in clients get mail |
| Anthropic (`ANTHROPIC_API_KEY`) | 🔴 **MISSING** everywhere | `server/services/conversationService.ts:4`; `POST /api/conversation/analyze` (`routes.ts:1263`) returns 500 |
| Deposit / invite / registration (`DEPOSIT_CONFIRM_SECRET`, `INVITE_SECRET`, `APP_BASE_URL`, `ALLOW_REGISTRATION`) | 🟢 Set in Vercel; fallbacks exist | `depositToken.ts:7`, `inviteService.ts:7-9`, `auth.ts:65` |
| Datadog (`DD_API_KEY`, `DD_SERVICE`, `DD_ENV`) | ⚪ **UNUSED** | No Datadog SDK installed; nothing reads them |
| `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | ⚪ **UNUSED** | `server/db.ts` only reads `DATABASE_URL` |
| Vercel platform | 🟢 OK | Prod URL public (200), Node 24, no runtime errors in 7 days (no traffic reaches the DB) |
| Horizon chat gateway | ⚪ Not deployed | `gateway/` scaffold on `chat/website`; see §8 |

**Git:** `main` == `origin/main` (`85c6839`). The only new remote branch is the Vercel bot's
`vercel/install-vercel-web-analytics-5oufvt` (adds `@vercel/analytics`; optional, not merged).
The chat scaffold was committed to `chat/website` as `044c6ac` so nothing is lost. Two old
stashes remain (`wip agents`, `WIP before branch switch`); untouched.

---

## 3. Credential inventory

Legend: **Hard** = app does not boot or route 500s · **Soft** = feature silently off · **Script** = CLI only.
"Where read" is `file:line` in this repo. Values never appear in this document.

### 3.1 Core (Node app on Vercel)

| Variable | Where read | Powers | Without it | Lives in |
|---|---|---|---|---|
| `DATABASE_URL` | `server/db.ts:7,13`, `drizzle.config.ts:3` | All data + session store | **Hard** (module throws) | Vercel prod+dev, local `.env` |
| `SESSION_SECRET` | `server/middleware/session.ts:11,26`; fallback key in `depositToken.ts:7`, `totpService.ts:15`, `inviteService.ts:8` | Cookie signing; **AES key for stored TOTP secrets**; invite/deposit HMAC fallback | **Hard** (`setupSession` throws) | Vercel prod+dev, local |
| `TOTP_ENCRYPTION_KEY` | `totpService.ts:15` | Dedicated TOTP encryption key | Soft, falls back to `SESSION_SECRET`. **Never introduce or rotate without a plan: every stored TOTP secret becomes unreadable.** | not set anywhere (keep it that way for now) |
| `DEPOSIT_CONFIRM_SECRET` | `depositToken.ts:7` | HMAC for public deposit-return links in cancel emails | Soft (falls back) | Vercel prod+dev |
| `INVITE_SECRET` | `inviteService.ts:7` | HMAC for admin invite links (7-day TTL) | Soft (falls back) | not set |
| `ALLOW_REGISTRATION` | `auth.ts:65` | Enables `POST /api/auth/register` only when exactly `"true"` | Soft (403) | Vercel prod+dev (value should be `false` or unset) |
| `APP_BASE_URL` | `emailService.ts:233`, `inviteService.ts:72` | Base for emailed links | Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then hardcoded prod URL | Vercel prod+dev |
| `NODE_ENV`, `PORT`, `VERCEL`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL` | various | Runtime mode, secure cookies, `/tmp` uploads, HTTP Neon driver | Platform-provided | Vercel sets these |

### 3.2 Google Calendar (OAuth 2.0, single shared refresh token)

| Variable | Where read | Without it |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `calendarService.ts:31`, `notificationService.ts:9` | Soft: calendar sync skipped |
| `GOOGLE_CLIENT_SECRET` | `calendarService.ts:32`, `notificationService.ts:10` | Soft |
| `GOOGLE_REFRESH_TOKEN` | `calendarService.ts:33`, `notificationService.ts:11` | Soft |
| `GOOGLE_CALENDAR_ID` | `calendarService.ts:11` | Soft (sync skipped) |
| `GOOGLE_ARCHIVE_CALENDAR_ID` | `calendarService.ts:13` | Optional; falls back to active calendar (`:96`) |

How it authenticates: `new google.auth.OAuth2(id, secret, 'https://developers.google.com/oauthplayground')`
with `setCredentials({ refresh_token })` (`calendarService.ts:42-52`). It is **not** a service
account and **not** per-user OAuth. Scopes are fixed at mint time: `calendar` and
`calendar.events` (the live token actually carries the full calendar scope family). Google Cloud
project number `790341112586`. APIs used: `events.insert/update/get/delete`, with
completed/cancelled appointments moved to the archive calendar.

Risks: a refresh token minted while the consent screen is in "Testing" expires in 7 days; any
token is revoked after 6 months of non-use or a Google password/security change. Contingency
prompt **DC1** re-mints it.

Not present anywhere in code: Gmail API, Google Drive, Sheets, service-account JSON, Google sign-in.

### 3.3 Email (Gmail over SMTP via nodemailer)

| Variable | Where read | Without it |
|---|---|---|
| `GMAIL_EMAIL` | `emailService.ts:12,43` | Soft: `sendEmail` returns false |
| `GMAIL_APP_PASSWORD` | `emailService.ts:13` | Soft |
| `NOTIFICATION_EMAIL` | `emailService.ts:343,374`, `testService.ts:47` | Soft: internal notifications dropped |

Sender account: the `se***@gmail.com` mailbox stored as `GMAIL_EMAIL` in Vercel. Uses a Gmail
**App Password** (requires 2-Step Verification on that account). The current one is rejected.

### 3.4 AI extraction ("Conversation Create")

| Variable | Where read | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | `conversationService.ts:4` (module scope) | Route 500s; rest of app fine (dynamic import inside try/catch at `routes.ts:1265`) |

Model id is hardcoded: `claude-sonnet-4-20250514` (`conversationService.ts:86,123`). It is
sixteen months old; Dispatch prompt D4 checks whether it is still served, and §9 proposes an
`ANTHROPIC_MODEL` env var.

### 3.5 Chat bridge (Node side, only on `chat/website`)

| Variable | Where read | Note |
|---|---|---|
| `CHAT_WEB_TOKEN_SECRET` (fallback `WEB_TOKEN_SECRET`) | `chatTokenService.ts:7` | Must equal the gateway's `WEB_TOKEN_SECRET` |
| `VITE_GATEWAY_URL` / `GATEWAY_PUBLIC_URL` | `routes.ts` web-token handler | Gateway URL returned to the widget |

### 3.6 Script-only

`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_USERNAME` (`db:seed-admin`);
`INVITE_EMAIL`, `INVITE_USERNAME` (`db:invite-admin`). Supplied inline when running the script.

### 3.7 Dead weight (remove)

`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `DD_API_KEY`, `DD_SERVICE`, `DD_ENV`.
Present in Vercel (prod+dev) and local `.env`; read by nothing.

---

## 4. Secret-handling rules for this work

1. **Vercel is the system of record.** Every secret is created or rotated in its own console and
   typed directly into Vercel → Project `serasomatic` → Settings → Environment Variables
   (targets: Production **and** Development unless stated). Local `.env` is regenerated with
   `vercel env pull .env`, never hand-edited with new secrets.
2. **Dispatch never reads a secret back into chat.** A prompt's "report" section asks only for
   variable names, targets, timestamps, and non-secret identifiers (row counts, hostnames,
   calendar names, key *names*).
3. **`SESSION_SECRET` is frozen** for the duration of this work. It keys TOTP encryption; rotating
   it logs everyone out and bricks every authenticator enrolment.
4. Database dumps go to `~/backups/serasomatic/` on this Mac, never into the repo
   (`server/data/*.json` already contains client PII and is tracked; do not add more).
5. Old credentials are revoked only **after** the replacement is verified in production.

---

## 5. Recovery runbook (ordered)

| # | Step | Owner | Blocks |
|---|---|---|---|
| R0 | Ship `GET /api/health` + `npm run check:creds` (§9) so every later step is measurable | Claude | nothing |
| R1 | Revive Replit DB (D1) → provision Neon target (D2) → dump/restore (§6) → cutover | Dispatch then Claude | everything else |
| R2 | Rotate Gmail app password, set `NOTIFICATION_EMAIL` (D3) | Dispatch | email notifications |
| R3 | Create Anthropic key, confirm model (D4) | Dispatch | Conversation Create |
| R4 | Verify Google Cloud consent screen + OAuth client health (D5, report-only) | Dispatch | nothing today; prevents a future outage |
| R5 | Vercel env cleanup: drop `PG*`, `DD_*`; set `ALLOW_REGISTRATION=false`; confirm `APP_BASE_URL` (D6) | Dispatch | hygiene |
| R6 | `vercel env pull`, `npm run check:creds`, redeploy, run §7 checklist | Claude | sign-off |
| DC1 | Contingency only: re-mint Google refresh token | Dispatch | only if `invalid_grant` appears |

---

## 6. Database migration and cutover

### 6.1 Facts that shape the procedure

- **On-disk backups are appointments only.** `server/data/backup_2026_07_19T21_15_42_712Z.json`
  and `attached_assets/Database_exports_7.19.26/appointments.json` are the same 121 rows.
  `databaseBackupService.ts` only ever backs up `appointments`. **Users, clients, providers,
  sessions, invites, and encrypted TOTP secrets exist only in the Replit DB.** That is why D1 comes first.
- The JSON import path (`db:import-replit-export` → `secureImportService.ts`) **re-assigns ids and
  nulls `client_id`** (`dataValidationService.ts:172`). Fine for the fallback, wrong for a migration.
- **App startup writes to the DB** (`storage.initializeDefaultProviders()` inserts 7 providers;
  `connect-pg-simple` creates `session`). Restore into the new DB **before** anything, including
  `npm run dev`, connects to it.
- Auth portability: passwords are bcrypt (portable); TOTP secrets are AES-256-GCM keyed from
  `sha256(TOTP_ENCRYPTION_KEY || SESSION_SECRET)`; sessions are rows in `session` signed by
  `SESSION_SECRET`. Nothing is tied to the Neon host or role. Keep `SESSION_SECRET` identical.
- Tooling on this Mac: `pg_dump`/`pg_restore`/`psql` 16 (Homebrew). Target `seramangement` is
  pg17 (restore 16→17 is fine). If the Replit source reports pg17, `brew install postgresql@17`
  and use that `pg_dump`.
- Neon strings: dump/restore use the **direct** endpoint; Vercel gets the **pooled** (`-pooler`)
  string because `server/db.ts` uses the Neon HTTP driver on Vercel.

### 6.2 Procedure (after D1 and D2 report back)

```bash
mkdir -p ~/backups/serasomatic && cd ~/backups/serasomatic
export SRC='<revived Replit DATABASE_URL, from Vercel env REPLIT_DATABASE_URL>'      # ?sslmode=require
export DST='<seramangement production branch DIRECT connection string>'           # not -pooler

# Preflight
psql "$SRC" -Atc "select version()"
psql "$SRC" -Atc "select table_name from information_schema.tables where table_schema='public' order by 1"
psql "$DST" -Atc "select count(*) from information_schema.tables where table_schema='public'"   # must be 0

# Dump (custom format + readable schema copy)
pg_dump "$SRC" -Fc --no-owner --no-privileges -f replit_$(date +%F).dump
pg_dump "$SRC" --schema-only --no-owner --no-privileges -f replit_$(date +%F).schema.sql
pg_restore -l replit_$(date +%F).dump | grep -E "TABLE DATA|SEQUENCE SET"   # expect users, session, clients, providers, appointments, appointments_backup_*

# Restore
pg_restore --dbname="$DST" --no-owner --no-privileges --clean --if-exists --exit-on-error -v replit_$(date +%F).dump
```

Do **not** run `drizzle-kit push` before or after the restore: the dump carries DDL, and push
would propose dropping `_drizzle_migrations` / `appointments_backup_*` and altering `session`
column types. The chat tables (`chat_messages`, `alignment_feedback`) are applied later, only
when `chat/website` merges, with `npx drizzle-kit push --strict --verbose` and a manual read of
the proposed statements.

If the new DB was touched by mistake: `psql "$DST" -c 'drop schema public cascade; create schema public;'` and restore again.

### 6.3 Verification (run against `$SRC` and `$DST`, diff the output)

```sql
select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', table_name), false, true, '')))[1]::text::int as rows
from information_schema.tables where table_schema='public' order by 1;
select sequencename, last_value from pg_sequences where schemaname='public' order by 1;
select id, username, email, totp_enabled, invite_pending, length(password)=60 as bcrypt_ok, totp_secret is not null as has_totp from users order by id;
select count(*) filter (where expire > now()) as live_sessions from session;
select count(*), min(id), max(id), max(updated_at) from appointments;
select count(*) as orphan_fk from appointments a left join clients c on c.id=a.client_id where a.client_id is not null and c.id is null;
```

### 6.4 Cutover

```bash
cd /Users/scottebsen/Projects/AppointmentManager-1
vercel env pull ~/backups/serasomatic/vercel.production.env --environment=production   # rollback copy, outside repo
# In Vercel UI (or CLI): replace DATABASE_URL (Production + Development) with the seramangement POOLED string
vercel --prod
curl -s https://serasomatic.vercel.app/api/health          # expect db:"ok"
# Browser: log in with password + authenticator code  (proves bcrypt + TOTP key continuity)
```

Then: remove `REPLIT_DATABASE_URL`, `PG*`, `DD_*` from Vercel (D6); `vercel env pull .env` locally;
`npm run check:creds` (includes a TOTP decrypt check).

**Rollback:** `vercel rollback` (the previous deployment carries the previous `DATABASE_URL`) or
re-add the old value from the pulled file and redeploy. Only meaningful while the Replit endpoint
is still enabled, so do not let Replit delete it until §7 is green.

### 6.5 Fallback if the Replit DB cannot be revived

Data after 2026-07-19 is lost, and all users must be re-created:

```bash
npx drizzle-kit push                      # empty seramangement DB
npm run db:seed-admin                     # SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD inline
npm run db:import-replit-export -- server/data/backup_2026_07_19T21_15_42_712Z.json
npm run db:migrate-clients && npm run db:link-clients
# re-enrol MFA for the admin; re-invite other users with npm run db:invite-admin
```

---

## 7. Verification checklist (sign-off)

1. `npm run check:creds` locally: `db ok`, `google ok` (both calendar names printed), `email ok`,
   `anthropic ok`, `totp-continuity ok`, no `deprecated` warnings.
2. `curl https://serasomatic.vercel.app/api/health` → `{"status":"ok","db":"ok","calendar":true,"email":true,"anthropic":true}`.
3. Browser login with existing admin + authenticator code succeeds; Appointments and Clients pages load with historical data.
4. Create a test appointment → event appears on "Scheduled-Rescheduled"; notification email arrives
   at `NOTIFICATION_EMAIL`. Cancel it → event moves to "Complete-Cancel"; cancel email arrives.
5. Conversation Create: paste sample text → fields extracted.
6. Vercel runtime errors (last 1h) clean after the test traffic.
7. Old Gmail app password deleted; Replit DB left enabled for 7 days, then decommissioned.

---

## 8. Phase 2 — Horizon chat gateway credentials (documented only)

Source: `gateway/app/config.py`, `.env.example` gateway block, `docs/chat/specfinal.md`.
The gateway is a FastAPI scaffold (health endpoint, Jev client, token helper); it has never been
deployed and Vercel is not its host (WebSockets → Fly.io).

| Variable | Required | Console / owner | Notes |
|---|---|---|---|
| `REDIS_URL` | yes | Upstash or Fly Redis | Only shared state between replicas |
| `XAI_API_KEY`, `GROK_MODEL` | yes | console.x.ai | Model id unverified (`docs/verified-models.md`) |
| `TYPESAFE_API_KEY`, `JEV_MODEL`, `JEV_*` | key optional | TypeSafe | Jev scoring; fail-open by default |
| `WEB_TOKEN_SECRET` | yes | generated | Must equal CRM `CHAT_WEB_TOKEN_SECRET` |
| `CRM_SESSION_SECRET` | yes | copy of CRM `SESSION_SECRET` | Verifies rep cookies against `session` table |
| `CRM_BASE_URL`, `GATEWAY_PUBLIC_URL` | yes | — | `https://serasomatic.vercel.app`, Fly app URL |
| `DATABASE_URL` / `NEON_DATABASE_URL` | one | Neon `seramangement` **dev branch** | Never production until Wave 5 |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_WEBHOOK_URL` | no | Twilio | SMS wave deferred (no 10DLC) |
| Fly.io account + `fly secrets set` | yes | fly.io | `gateway/fly.toml` is a placeholder |

CRM side (Vercel) will additionally need `CHAT_WEB_TOKEN_SECRET` and `VITE_GATEWAY_URL`.
None of this blocks the CRM recovery.

---

## 9. Code changes on `cred-update` (R0)

| File | Change |
|---|---|
| `server/services/healthService.ts` (new) | `getHealthStatus()` → `{status, db, calendar, email, anthropic, commit}`; `db` via `select 1` with 3 s timeout; booleans are presence-only |
| `server/routes.ts` | `GET /api/health` registered **before `setupSession`** so a stale cookie cannot 500 through the pg session store; 200/503; `Cache-Control: no-store` |
| `server/middleware/requireAuth.ts` | add `GET /api/health` to `PUBLIC_API_ROUTES` |
| `server/scripts/checkCreds.ts` (new) + `package.json` `check:creds` | DB select, Google token + `calendars.get` on both IDs, `nodemailer.verify()`, Anthropic key (+ `--live` models.list), secrets presence, TOTP decrypt continuity, deprecated-var warning; prints names and statuses only |
| `server/services/emailService.ts` | `export const createTransporter` (one word) |
| `.env.example` | Consolidated: Core, Auth, Google Calendar, Email, AI, Chat bridge, scripts, gateway block; comment that `PG*`/`DD_*` are unused |
| `replit.md` | Env section → pointer to `.env.example` + SESSION_SECRET/TOTP warning |
| Proposed, needs OK | `ANTHROPIC_MODEL` env var with a current default replacing the hardcoded `claude-sonnet-4-20250514` |

---

## 10. Dispatch prompts

Each prompt is self-contained. Paste it into Dispatch as written. Every prompt ends with a
**Report back** list; Dispatch should answer only those items and never include a secret value.

### D1 — Replit: revive the database and stage its connection string

```
Goal: re-enable the Postgres database attached to my old Replit project for the Serasomatic
appointment app (the deployment used to live at scheduleing.replit.app; the Repl is probably
named "AppointmentManager", "scheduleing" or similar). The database is a Replit-managed Neon
database whose host is ep-falling-scene-a4h6hlx0.us-east-1.aws.neon.tech.

Steps:
1. Open https://replit.com in my signed-in browser. Find the Repl (search "Appointment",
   "scheduleing", "Serasomatic"). If the account shows a paused/billing banner, tell me and stop.
2. Open the Repl → left pane "Database" (or "Storage" → "PostgreSQL"). If the database shows as
   disabled/suspended, click the enable/wake action. Wait until it reports connected. The
   Replit AI agent may offer to "re-enable" via the API; accepting that is fine.
3. In the Database pane open the SQL console / "Query" tab and run, one at a time:
     select count(*) from users;
     select count(*) from clients;
     select count(*) from providers;
     select count(*) from appointments;
     select max(updated_at) from appointments;
     select version();
   Write down the six results.
4. In the same pane, locate the connection string (DATABASE_URL). Do not paste it into chat.
   Open https://vercel.com in a new tab → team "sethrocks-projects" → project "serasomatic" →
   Settings → Environment Variables → "Add new". Key: REPLIT_DATABASE_URL. Value: paste the
   connection string. Environment: Development only. Mark as Sensitive. Save.
5. Do NOT change any existing Vercel variable. Do NOT delete or modify anything in Replit.
   Do NOT run any write statements in the SQL console.

Report back: whether the DB is now enabled; the six query results; the Postgres major version;
confirmation that REPLIT_DATABASE_URL exists in Vercel (Development). If the Repl or its database
no longer exists, say exactly what Replit shows so we switch to the backup plan.
```

### D2 — Neon: prepare the destination project and stage its connection strings

```
Goal: prepare my own Neon project "seramangement" (project id square-rice-65609182, region
aws-us-east-1) to receive the Serasomatic CRM database, and stage its connection strings in
Vercel. Do not create a new Neon project.

Steps:
1. Open https://console.neon.tech in my signed-in browser → project "seramangement".
2. Branches: the "production" branch (br-delicate-band-a4fh1coi) is archived. Open it; if the
   console offers "Unarchive"/"Restore", do it. Confirm the branch's compute shows Idle or Active.
3. Dashboard → "Connect"/"Connection string". Database "neondb", role "neondb_owner" (or the
   default owner). Capture two variants, by toggling the "Pooled connection" switch:
     a) pooled OFF  (direct host, no "-pooler")
     b) pooled ON   (host contains "-pooler")
   Both must end with ?sslmode=require. Do not paste them into chat.
4. Open https://vercel.com → team "sethrocks-projects" → project "serasomatic" → Settings →
   Environment Variables. Add:
     Key NEON_DIRECT_URL  Value = (a)  Environment: Development only  Sensitive
     Key DATABASE_URL_NEW Value = (b)  Environment: Production and Development  Sensitive
   Save. Do NOT touch the existing DATABASE_URL.
5. Back in Neon, Tables view for branch "production": confirm it has no tables (it should be
   empty). If it has tables, list their names and stop.

Report back: branch state after step 2; the direct host name (host only, e.g.
ep-xxxx.us-east-1.aws.neon.tech) and the pooled host name; confirmation that NEON_DIRECT_URL and
DATABASE_URL_NEW exist in Vercel; whether the production branch is empty.
```

### D3 — Gmail: rotate the app password and set the notification recipient

```
Goal: the Serasomatic CRM sends appointment emails through Gmail SMTP from the se***@gmail.com
account (the exact address is the GMAIL_EMAIL value in Vercel; read it there first). Its app
password is being rejected (SMTP 535). Create a new app password and store it in Vercel.

Steps:
1. Open https://vercel.com → team "sethrocks-projects" → project "serasomatic" → Settings →
   Environment Variables. Note the value of GMAIL_EMAIL (an email address, not a secret).
2. Open https://myaccount.google.com in my browser and make sure the signed-in account is that
   address (switch accounts if needed). Security → "2-Step Verification". If it is OFF, tell me and
   stop (app passwords require it). If ON, continue.
3. Go to https://myaccount.google.com/apppasswords. Create an app password named
   "Serasomatic Vercel 2026-10". Google shows a 16-character code once. Do not paste it into chat.
4. In the Vercel tab, edit GMAIL_APP_PASSWORD: replace the value for BOTH Production and
   Development with the new code (no spaces). Mark Sensitive. Save.
5. Still in Vercel, add NOTIFICATION_EMAIL (Production and Development) set to the same address
   as GMAIL_EMAIL unless I have told you a different inbox. Save.
6. Back on the Google app-passwords page: if an older Serasomatic/Replit app password exists,
   leave it for now (we delete it after production is verified). List its name only.

Report back: that 2-Step is on; the new app password's name; confirmation GMAIL_APP_PASSWORD was
updated for Production and Development; the NOTIFICATION_EMAIL value you set; names of any
older app passwords present.
```

### D4 — Anthropic: create the API key and check the model

```
Goal: provision an Anthropic API key for the Serasomatic CRM's "Conversation Create" feature
and store it in Vercel.

Steps:
1. Open https://console.anthropic.com in my signed-in browser. Pick the workspace I normally use
   (if there is a workspace called "Serasomatic" use it; otherwise the default workspace).
2. Settings → Billing: confirm a payment method or credits exist. If none, tell me and stop.
3. Settings → Limits (or workspace limits): set a monthly spend limit of $50 if the UI allows.
4. API Keys → Create Key. Name: "serasomatic-vercel-prod". Copy it once; do not paste it in chat.
5. Open https://vercel.com → team "sethrocks-projects" → project "serasomatic" → Settings →
   Environment Variables → Add: Key ANTHROPIC_API_KEY, Value = the key, Environment: Production
   and Development, Sensitive. Save.
6. Back in the Anthropic console, open the Models / model deprecations page in Docs
   (https://docs.anthropic.com → Models). Check whether the model id
   "claude-sonnet-4-20250514" is still available or is listed as deprecated/retired, and note the
   current recommended Sonnet model id.

Report back: workspace name; whether billing is active; the key name; confirmation
ANTHROPIC_API_KEY exists for Production and Development; the status of claude-sonnet-4-20250514
and the current recommended Sonnet model id.
```

### D5 — Google Cloud: verify the Calendar OAuth setup (report-only)

```
Goal: confirm the Google Cloud OAuth setup behind the Serasomatic CRM's calendar sync is
healthy so the working refresh token does not expire unexpectedly. Change nothing.

Context: the OAuth client id starts with 790341112586- and ends with
vl4.apps.googleusercontent.com. The token has calendar scopes and was minted through the
OAuth Playground.

Steps:
1. Open https://console.cloud.google.com in my browser. Use the project selector; the project
   number is 790341112586. Open it.
2. APIs & Services → OAuth consent screen (or "Google Auth Platform" → Branding/Audience).
   Record: Publishing status (must be "In production", not "Testing"); User type
   (Internal/External); whether a verification warning is shown.
3. APIs & Services → Credentials. Find the OAuth 2.0 Client ID matching the id above. Record its
   type (Web application) and whether https://developers.google.com/oauthplayground is among the
   authorized redirect URIs.
4. APIs & Services → Enabled APIs. Confirm "Google Calendar API" is enabled. Record whether
   "Gmail API" is enabled (it is not needed; just report).
5. Do not create, edit, or delete anything.

Report back: publishing status, user type, any warnings; whether the client exists with the
playground redirect; whether Calendar API is enabled. If publishing status is "Testing", say so
prominently: that means the token will expire 7 days after minting and we must publish the app
and re-mint (prompt DC1).
```

### D6 — Vercel: environment cleanup and settings check

```
Goal: tidy the Serasomatic Vercel project's environment variables after the new credentials are
in place. Only do this AFTER I confirm D1–D4 are done.

Steps:
1. Open https://vercel.com → team "sethrocks-projects" → project "serasomatic" → Settings →
   Environment Variables.
2. Delete these keys in every environment where they exist (they are not read by the app):
   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, DD_API_KEY, DD_SERVICE, DD_ENV.
3. ALLOW_REGISTRATION: set the value to false for Production and Development (create if missing).
4. APP_BASE_URL: confirm Production value is https://serasomatic.vercel.app (no trailing slash).
   If different, tell me; do not change it.
5. Confirm these keys exist (do not reveal values): DATABASE_URL, SESSION_SECRET,
   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID,
   GOOGLE_ARCHIVE_CALENDAR_ID, GMAIL_EMAIL, GMAIL_APP_PASSWORD, NOTIFICATION_EMAIL,
   ANTHROPIC_API_KEY, DEPOSIT_CONFIRM_SECRET, ALLOW_REGISTRATION, APP_BASE_URL.
6. Settings → Deployment Protection: record the current setting. Do not change it.
7. Do NOT delete DATABASE_URL, DATABASE_URL_NEW, NEON_DIRECT_URL or REPLIT_DATABASE_URL; I remove
   the temporary ones myself after cutover.

Report back: which keys were deleted and from which environments; ALLOW_REGISTRATION value;
APP_BASE_URL value; the list from step 5 with present/missing; the deployment protection setting.
```

### DC1 — Contingency: re-mint the Google refresh token (only if calendar sync fails with `invalid_grant`)

```
Goal: mint a new Google OAuth refresh token for the Serasomatic calendar sync using the OAuth
Playground with our own OAuth client, and store it in Vercel. Only do this if I ask for DC1.

Steps:
1. If D5 reported the consent screen as "Testing": in Google Cloud (project 790341112586) →
   OAuth consent screen → "Publish app" → confirm. Then continue.
2. Open https://vercel.com → project "serasomatic" → Settings → Environment Variables. You will
   need GOOGLE_CLIENT_ID (not secret) and GOOGLE_CLIENT_SECRET (secret; reveal it only inside the
   Vercel UI and type it into the Playground field, never into chat).
3. Open https://developers.google.com/oauthplayground. Click the gear icon → check "Use your own
   OAuth credentials" → enter the client id and client secret.
4. Step 1 in the Playground: in the scope box enter exactly
     https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events
   Click "Authorize APIs". Sign in with the Google account that owns the calendars
   "Scheduled-Rescheduled" and "Complete-Cancel" (the same se***@gmail.com account). Accept.
5. Step 2: click "Exchange authorization code for tokens". Copy the Refresh token value once.
6. In Vercel, edit GOOGLE_REFRESH_TOKEN for Production and Development with the new value.
   Mark Sensitive. Save.
7. Do not change GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.

Report back: whether you had to publish the consent screen; the account you authorized with;
confirmation GOOGLE_REFRESH_TOKEN was updated for both environments and the time you did it.
```

---

## 11. Open questions for the owner

1. Is the notification inbox the same mailbox as the sender (`GMAIL_EMAIL`), or a different address? (D3 step 5)
2. Approve replacing the hardcoded Anthropic model id with an `ANTHROPIC_MODEL` env var (§9)?
3. Should the Vercel bot branch `vercel/install-vercel-web-analytics-5oufvt` be merged into `main` as part of this PR, or left alone?
4. After cutover, how long should the Replit DB stay enabled before decommissioning (default: 7 days)?
