# Sissy Sabrina Contract Site

Production Next.js app for a consensual adult BDSM feminization training contract between **Marcus** (Master/Trainer) and **Sabrina** (formerly Seth).

Live target: [https://sissysabrina.vercel.app](https://sissysabrina.vercel.app)

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Neon serverless Postgres (`@neondatabase/serverless`)
- `qrcode` for certificate QR
- `react-signature-canvas` for dual signature pads
- Vercel deployment

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Full contract terms + fillable form + signatures + Seal |
| `/certificate/[id]` | Public Certificate of Ownership + QR + SMS inquire link |
| `/admin?key=…` | Optional sealed-contract list (`ADMIN_KEY`) |

## Environment

Copy `.env.example` → `.env.local`:

```bash
DATABASE_URL=postgresql://…neon.tech/neondb?sslmode=require
SMS_TO=6198766618
NEXT_PUBLIC_SMS_TO=6198766618
NEXT_PUBLIC_SITE_URL=https://sissysabrina.vercel.app
ADMIN_KEY=optional-secret
```

## Database

Run `sql/schema.sql` on Neon:

```sql
create extension if not exists pgcrypto;

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  master_name text not null default 'Marcus',
  slave_name text not null default 'Sabrina',
  prior_name text not null default 'Seth',
  term text not null default 'Up to 24 hours',
  start_date date,
  location text,
  master_addendum text,
  master_signature text,
  slave_signature text,
  agreed boolean not null default false,
  payload text not null,
  created_at timestamptz not null default now()
);
```

## Local

```bash
npm install
npm run dev
```

Seal flow: fill form → both signatures → 18+ checkbox → Seal → redirect to `/certificate/{id}`.

## SMS footer

Certificate (and form) include:

```html
<a href="sms:6198766618?body=i%20would%20like%20to%20inquire%20about%20training%20Sabrina%20and%20using%20here">
  I request from current owner permission to train Sabrina
</a>
```

## Deploy (Vercel)

1. Create Vercel project named `sissysabrina`.
2. Set env vars above (Production + Preview).
3. Deploy. Production URL should be `sissysabrina.vercel.app` when the name is free.

## Disclaimer

Consensual adult role/training instrument only. Not a legal transfer of a person. 18+.
