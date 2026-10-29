/**
 * One-shot repair: recreate the `cash_collection_log` table that the
 * `cash_collection_trigger` on `appointments` writes to.
 *
 *   npm run db:ensure-cash-log
 *
 * Reads DATABASE_URL from .env. Safe to re-run. Prints the triggers on
 * `appointments` afterwards so you can confirm what the database still carries.
 */
import { neon } from "@neondatabase/serverless";
import { ensureCashCollectionLog } from "../ensureCashCollectionLog";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);

  await ensureCashCollectionLog((statement) => sql(statement));

  const table = await sql`
    SELECT to_regclass('public.cash_collection_log')::text AS name
  `;
  console.log("cash_collection_log:", table[0]?.name ? "present" : "MISSING");

  const triggers = await sql`
    SELECT t.tgname AS trigger_name, p.proname AS function_name
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.appointments'::regclass
      AND NOT t.tgisinternal
    ORDER BY t.tgname
  `;
  if (triggers.length === 0) {
    console.log("appointments triggers: none");
  } else {
    for (const row of triggers) {
      console.log(`appointments trigger: ${row.trigger_name} -> ${row.function_name}()`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
