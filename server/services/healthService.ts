import { sql } from "drizzle-orm";
import { db } from "../db";
import { log } from "../logger";

export type HealthStatus = {
  status: "ok" | "degraded";
  db: "ok" | "fail";
  calendar: boolean;
  email: boolean;
  anthropic: boolean;
  /** Hostname of DATABASE_URL (no credentials); lets a cutover be verified externally. */
  dbHost?: string;
  commit?: string;
};

const DB_TIMEOUT_MS = 3000;

/** Presence-only flags. Never performs network calls or exposes values. */
export function getIntegrationFlags() {
  return {
    calendar: Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REFRESH_TOKEN &&
        process.env.GOOGLE_CALENDAR_ID,
    ),
    email: Boolean(
      process.env.GMAIL_EMAIL &&
        process.env.GMAIL_APP_PASSWORD &&
        process.env.NOTIFICATION_EMAIL,
    ),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}

async function checkDb(): Promise<"ok" | "fail"> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`db check timed out after ${DB_TIMEOUT_MS}ms`)),
      DB_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([db.execute(sql`select 1`), timeout]);
    return "ok";
  } catch (error) {
    log(`db check failed: ${(error as Error).message}`, "health");
    return "fail";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function dbHost(): string | undefined {
  try {
    return process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : undefined;
  } catch {
    return "unparseable";
  }
}

/** Safe for an unauthenticated route: no secret values, no third-party calls. */
export async function getHealthStatus(): Promise<HealthStatus> {
  const dbStatus = await checkDb();
  const flags = getIntegrationFlags();
  return {
    status: dbStatus === "ok" ? "ok" : "degraded",
    db: dbStatus,
    ...flags,
    dbHost: dbHost(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  };
}
