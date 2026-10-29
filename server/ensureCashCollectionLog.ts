/**
 * Keeps the legacy `cash_collection_log` table in place.
 *
 * The production `appointments` table carries a trigger inherited from the
 * Replit-era database: `cash_collection_trigger` -> `log_cash_collection()`.
 * It INSERTs a row into `cash_collection_log` every time
 * `appointments.total_collected_cash` is written. The trigger lives only in the
 * database (drizzle does not manage triggers), so a dump/restore or a
 * `drizzle-kit push` that drops the "unknown" table leaves the trigger pointing
 * at nothing, and every appointment update then fails with
 * `relation "cash_collection_log" does not exist` (SQLSTATE 42P01).
 *
 * These statements are idempotent and run on every cold start (see
 * server/index.ts), so the app repairs the table itself on deploy. The same
 * DDL is kept in server/scripts/ensureCashCollectionLog.sql for pasting into
 * the Neon SQL editor, and `npm run db:ensure-cash-log` runs it from a shell.
 * The table is also declared in shared/schema.ts so `drizzle-kit push` keeps it.
 */
export const CASH_COLLECTION_LOG_TABLE = "cash_collection_log";

export const CASH_COLLECTION_LOG_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS public.cash_collection_log (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    old_amount DOUBLE PRECISION,
    new_amount DOUBLE PRECISION,
    difference DOUBLE PRECISION,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS cash_collection_log_appointment_id_idx
    ON public.cash_collection_log(appointment_id)`,
  `CREATE INDEX IF NOT EXISTS cash_collection_log_processed_idx
    ON public.cash_collection_log(processed)
    WHERE processed = FALSE`,
];

/**
 * Runs the DDL above through whatever query runner the caller has
 * (drizzle `db.execute` at startup, a raw Neon client in scripts).
 */
export async function ensureCashCollectionLog(
  run: (statement: string) => Promise<unknown>,
): Promise<void> {
  for (const statement of CASH_COLLECTION_LOG_STATEMENTS) {
    await run(statement);
  }
}
