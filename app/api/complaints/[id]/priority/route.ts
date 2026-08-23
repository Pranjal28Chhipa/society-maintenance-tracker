import { requireAdmin } from "@/lib/auth";
import { changePriority } from "@/lib/complaints";
import { PRIORITIES } from "@/lib/domain";
import { handle, json, readJson } from "@/lib/http";
import { enumValue } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/complaints/:id/priority - admin triage.
 *
 * Body: `{ priority: "LOW" | "MEDIUM" | "HIGH" }`. Recorded in history but not
 * emailed - priority is internal triage, not resident-facing progress.
 */
export const PATCH = handle(async (request: Request, { params }: Params) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await readJson(request);

  const complaint = await changePriority(
    admin,
    id,
    enumValue(body.priority, PRIORITIES, "priority"),
  );

  return json({ complaint });
});
