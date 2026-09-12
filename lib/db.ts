import { neon } from "@neondatabase/serverless";

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(url);
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
