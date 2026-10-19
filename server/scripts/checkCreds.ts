/**
 * Read-only credential check. Prints `name: ok|fail|missing (detail)` and never
 * prints secret values. Run with: npm run check:creds [-- --live]
 *
 *   --live   also calls the Anthropic API (models.list) instead of checking presence only.
 *
 * Exit code 1 when the database is unreachable or a hard-required variable is missing.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { google } from "googleapis";
import { createTransporter } from "../services/emailService";
import { decryptSecret } from "../services/totpService";

type Result = { name: string; status: "ok" | "fail" | "missing" | "warn"; detail?: string };

const results: Result[] = [];
const live = process.argv.includes("--live");

function record(name: string, status: Result["status"], detail?: string) {
  results.push({ name, status, detail });
  const suffix = detail ? ` (${detail})` : "";
  console.log(`${name}: ${status}${suffix}`);
}

function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "unparseable";
  }
}

type Sql = NeonQueryFunction<false, false>;

async function checkDb(): Promise<Sql | null> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    record("db", "missing", "DATABASE_URL not set");
    return null;
  }
  try {
    const sql = neon(url);
    const rows = (await sql`select current_database() as db, version() as version`) as Array<{
      db: string;
      version: string;
    }>;
    const major = rows[0]?.version.match(/PostgreSQL (\d+)/)?.[1] ?? "?";
    record("db", "ok", `${hostOf(url)} · ${rows[0]?.db} · pg${major}`);
    return sql;
  } catch (error) {
    record("db", "fail", `${hostOf(url)} · ${(error as Error).message}`);
    return null;
  }
}

async function checkGoogle() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    record("google", "missing", "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN");
    return;
  }
  // Mirrors server/services/calendarService.ts getAuthClient() without importing storage/db.
  const auth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground",
  );
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  try {
    await auth.getAccessToken();
    record("google-token", "ok", "refresh token mints access tokens");
  } catch (error) {
    const data = (error as { response?: { data?: { error?: string } } }).response?.data;
    record("google-token", "fail", data?.error ?? (error as Error).message);
    return;
  }
  const calendar = google.calendar({ version: "v3", auth });
  const ids: Array<[string, string | undefined]> = [
    ["google-calendar-active", process.env.GOOGLE_CALENDAR_ID],
    ["google-calendar-archive", process.env.GOOGLE_ARCHIVE_CALENDAR_ID],
  ];
  for (const [name, calendarId] of ids) {
    if (!calendarId) {
      record(name, name.endsWith("archive") ? "warn" : "missing", "calendar id not set");
      continue;
    }
    try {
      const res = await calendar.calendars.get({ calendarId });
      record(name, "ok", res.data.summary ?? "unnamed calendar");
    } catch (error) {
      record(name, "fail", (error as Error).message);
    }
  }
}

async function checkEmail() {
  if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
    record("email", "missing", "GMAIL_EMAIL / GMAIL_APP_PASSWORD");
  } else {
    const transporter = createTransporter();
    try {
      await transporter!.verify();
      record("email", "ok", "SMTP login accepted");
    } catch (error) {
      record("email", "fail", (error as Error).message.split("\n")[0]);
    }
  }
  if (!process.env.NOTIFICATION_EMAIL) {
    record("notification-email", "missing", "NOTIFICATION_EMAIL not set; internal notifications are dropped");
  } else {
    record("notification-email", "ok");
  }
}

async function checkAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    record("anthropic", "missing", "ANTHROPIC_API_KEY not set; /api/conversation/analyze will 500");
    return;
  }
  if (!key.startsWith("sk-ant-")) {
    record("anthropic", "warn", "key does not start with sk-ant-");
  }
  if (!live) {
    record("anthropic", "ok", "present; pass --live to call the API");
    return;
  }
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });
    const page = await client.models.list({ limit: 1 });
    record("anthropic", "ok", `API reachable; first model ${page.data[0]?.id ?? "n/a"}`);
  } catch (error) {
    record("anthropic", "fail", (error as Error).message.split("\n")[0]);
  }
}

function checkSecrets() {
  const required = ["SESSION_SECRET"];
  const optional = [
    ["TOTP_ENCRYPTION_KEY", "falls back to SESSION_SECRET; never introduce without re-encrypting"],
    ["DEPOSIT_CONFIRM_SECRET", "falls back to SESSION_SECRET"],
    ["INVITE_SECRET", "falls back to SESSION_SECRET"],
    ["APP_BASE_URL", "falls back to the Vercel production URL"],
    ["CHAT_WEB_TOKEN_SECRET", "only needed once the chat gateway ships"],
  ] as const;
  for (const name of required) {
    record(`secret:${name}`, process.env[name] ? "ok" : "missing");
  }
  for (const [name, note] of optional) {
    record(`secret:${name}`, process.env[name] ? "ok" : "warn", process.env[name] ? undefined : note);
  }
  if (process.env.ALLOW_REGISTRATION === "true") {
    record("allow-registration", "warn", "ALLOW_REGISTRATION=true leaves /api/auth/register open");
  }
}

async function checkTotpContinuity(sql: Sql | null) {
  if (!sql) {
    record("totp-continuity", "warn", "skipped; database unreachable");
    return;
  }
  try {
    const rows = (await sql`select totp_secret from users where totp_enabled and totp_secret is not null limit 1`) as Array<{
      totp_secret: string;
    }>;
    if (!rows.length) {
      record("totp-continuity", "warn", "no enrolled TOTP users to verify");
      return;
    }
    decryptSecret(rows[0].totp_secret);
    record("totp-continuity", "ok", "stored TOTP secret decrypts with the current key");
  } catch (error) {
    record("totp-continuity", "fail", `cannot decrypt: ${(error as Error).message}; SESSION_SECRET/TOTP_ENCRYPTION_KEY changed?`);
  }
}

function checkDeprecated() {
  const dead = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "DD_API_KEY", "DD_SERVICE", "DD_ENV"].filter(
    (name) => process.env[name] !== undefined,
  );
  if (dead.length) {
    record("deprecated", "warn", `${dead.join(", ")} are not read by this app; safe to remove`);
  } else {
    record("deprecated", "ok", "no unused variables set");
  }
}

async function main() {
  console.log(`check:creds · ${new Date().toISOString()}${live ? " · live" : ""}\n`);
  const sql = await checkDb();
  await checkGoogle();
  await checkEmail();
  await checkAnthropic();
  checkSecrets();
  await checkTotpContinuity(sql);
  checkDeprecated();

  const failed = results.filter((r) => r.status === "fail");
  const hardMissing = results.filter((r) => r.status === "missing" && (r.name === "db" || r.name.startsWith("secret:")));
  console.log(
    `\n${results.filter((r) => r.status === "ok").length} ok · ${failed.length} fail · ` +
      `${results.filter((r) => r.status === "missing").length} missing · ${results.filter((r) => r.status === "warn").length} warn`,
  );
  if (failed.some((r) => r.name === "db") || hardMissing.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
