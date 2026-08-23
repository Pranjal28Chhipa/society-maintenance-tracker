import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import { handle, json } from "@/lib/http";

/** GET /api/dashboard - admin summary: counts by status, category and priority, plus overdue. */
export const GET = handle(async () => {
  await requireAdmin();
  return json(await getDashboard());
});
