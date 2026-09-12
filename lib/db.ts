import { neon } from "@neondatabase/serverless";

function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  throw new Error("DATABASE_URL is not set");
}

export function getSql() {
  return neon(resolveDatabaseUrl());
}

export type ContractRow = {
  id: string;
  master_name: string;
  slave_name: string;
  prior_name: string;
  term: string;
  start_date: string | Date | null;
  location: string | null;
  master_addendum: string | null;
  master_signature: string | null;
  slave_signature: string | null;
  agreed: boolean;
  payload: string;
  created_at: string | Date;
};
