import { requireAdmin, requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/http";
import { getOverdueThresholdDays, setOverdueThresholdDays } from "@/lib/settings";
import { boundedInt } from "@/lib/validate";

/** GET /api/settings - current society settings. Readable by any signed-in user. */
export const GET = handle(async () => {
  await requireUser();
  return json({ overdueThresholdDays: await getOverdueThresholdDays() });
});

/**
 * PATCH /api/settings - admin updates the overdue threshold.
 *
 * Body: `{ overdueThresholdDays: number }` (1-365). Because overdue state is
 * derived at read time, changing this immediately re-evaluates every existing
 * complaint - no backfill job.
 */
export const PATCH = handle(async (request: Request) => {
  await requireAdmin();
  const body = await readJson(request);

  const days = boundedInt(body.overdueThresholdDays, "overdueThresholdDays", {
    min: 1,
    max: 365,
  });

  return json({ overdueThresholdDays: await setOverdueThresholdDays(days) });
});
