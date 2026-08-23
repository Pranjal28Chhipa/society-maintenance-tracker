import { requireAdmin } from "@/lib/auth";
import { setOverdueFlag } from "@/lib/complaints";
import { badRequest, handle, json, readJson } from "@/lib/http";
import { optionalString } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/complaints/:id/overdue - raise or clear the explicit overdue flag.
 *
 * Body: `{ flagged: boolean, note?: string }`. This is separate from the
 * threshold-derived overdue state, which needs no endpoint because it is
 * recomputed on every read.
 */
export const PATCH = handle(async (request: Request, { params }: Params) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await readJson(request);

  if (typeof body.flagged !== "boolean") {
    throw badRequest("Validation failed", { flagged: "flagged must be true or false" });
  }

  const complaint = await setOverdueFlag(
    admin,
    id,
    body.flagged,
    optionalString(body.note, "note", { max: 1000 }),
  );

  return json({ complaint });
});
