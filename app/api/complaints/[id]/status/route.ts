import { requireAdmin } from "@/lib/auth";
import { changeStatus } from "@/lib/complaints";
import { COMPLAINT_STATUSES } from "@/lib/domain";
import { handle, json, readJson } from "@/lib/http";
import { enumValue, optionalString } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/complaints/:id/status - admin moves a complaint along its lifecycle.
 *
 * Body: `{ status: "OPEN" | "IN_PROGRESS" | "RESOLVED", note?: string }`.
 * Invalid transitions (anything out of RESOLVED, or a no-op) return 409.
 * The resident is emailed on success.
 */
export const PATCH = handle(async (request: Request, { params }: Params) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await readJson(request);

  const complaint = await changeStatus(
    admin,
    id,
    enumValue(body.status, COMPLAINT_STATUSES, "status"),
    optionalString(body.note, "note", { max: 1000 }),
  );

  return json({ complaint });
});
