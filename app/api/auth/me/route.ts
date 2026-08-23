import { getCurrentUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";

/** GET /api/auth/me - the signed-in user, or `{ user: null }` when anonymous. */
export const GET = handle(async () => {
  const user = await getCurrentUser();
  return json({ user });
});
