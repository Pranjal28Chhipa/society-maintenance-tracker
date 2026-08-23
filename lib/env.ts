/**
 * Centralised environment access.
 *
 * Every optional integration (mail, blob storage) degrades to a local
 * no-account fallback so the app can be cloned and run with nothing but a
 * database. `assertServerEnv()` fails loudly for the two variables that have
 * no sensible default.
 */

function getBlobToken(): string {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => k.endsWith("_READ_WRITE_TOKEN"));
  if (key) return process.env[key] ?? "";
  return "";
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  authSecret: process.env.AUTH_SECRET ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  mailFrom: process.env.MAIL_FROM || "Society Maintenance <onboarding@resend.dev>",
  blobToken: getBlobToken(),
  defaultOverdueThresholdDays: Number(process.env.OVERDUE_THRESHOLD_DAYS ?? 5),
};

/** Public base URL, used to build absolute links inside outgoing emails. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** True when a real mail provider is configured; otherwise mail is logged. */
export const mailEnabled = () => env.resendApiKey.length > 0;

/** True when Vercel Blob is configured; otherwise photos go to local disk. */
export const blobEnabled = () => env.blobToken.length > 0;

export function assertServerEnv() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }
  if (env.authSecret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -base64 32",
    );
  }
}
