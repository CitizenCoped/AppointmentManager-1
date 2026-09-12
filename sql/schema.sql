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
