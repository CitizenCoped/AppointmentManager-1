-- Production hotfix: appointments UPDATE OF total_collected_cash fires
-- trigger cash_collection_trigger → log_cash_collection(), which INSERTs
-- into cash_collection_log. That table was missing after the Neon restore,
-- causing PATCH /api/appointments/:id to 500 when cash collections change
-- (e.g. Complete Appointment).
--
-- Safe to re-run. Applied to Neon project seramangement / production
-- (square-rice-65609182 / br-delicate-band-a4fh1coi) on 2026-10-27.
--
-- Paste into the Neon SQL editor for the database Vercel's DATABASE_URL points
-- at. The app also runs this automatically on every cold start
-- (server/ensureCashCollectionLog.ts), and `npm run db:ensure-cash-log` runs it
-- from a shell. Keep the three copies identical.

CREATE TABLE IF NOT EXISTS public.cash_collection_log (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  old_amount DOUBLE PRECISION,
  new_amount DOUBLE PRECISION,
  difference DOUBLE PRECISION,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cash_collection_log_appointment_id_idx
  ON public.cash_collection_log(appointment_id);

CREATE INDEX IF NOT EXISTS cash_collection_log_processed_idx
  ON public.cash_collection_log(processed)
  WHERE processed = FALSE;
