import { requireUser } from "@/lib/auth";
import { getComplaint } from "@/lib/complaints";
import { handle, json } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/** GET /api/complaints/:id - one complaint plus its full status history. */
export const GET = handle(async (_request: Request, { params }: Params) => {
  const user = await requireUser();
  const { id } = await params;
  return json({ complaint: await getComplaint(user, id) });
});
