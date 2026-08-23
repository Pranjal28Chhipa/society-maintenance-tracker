import "server-only";

import { prisma } from "./db";
import { env } from "./env";

export const OVERDUE_THRESHOLD_KEY = "overdue_threshold_days";

const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 365;

function clamp(value: number): number {
  if (!Number.isFinite(value)) return env.defaultOverdueThresholdDays;
  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.round(value)));
}

/**
 * Reads the configurable overdue threshold.
 *
 * Stored in the `Setting` table so an admin can change it at runtime; the
 * `OVERDUE_THRESHOLD_DAYS` env var only supplies the value used the first time
 * the row is created.
 */
export async function getOverdueThresholdDays(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: OVERDUE_THRESHOLD_KEY } });
  if (row) return clamp(Number(row.value));
  return clamp(env.defaultOverdueThresholdDays);
}

export async function setOverdueThresholdDays(days: number): Promise<number> {
  const value = clamp(days);
  await prisma.setting.upsert({
    where: { key: OVERDUE_THRESHOLD_KEY },
    create: { key: OVERDUE_THRESHOLD_KEY, value: String(value) },
    update: { value: String(value) },
  });
  return value;
}
