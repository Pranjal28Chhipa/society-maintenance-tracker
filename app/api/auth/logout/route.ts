import { destroySession } from "@/lib/auth";
import { handle, json } from "@/lib/http";

/** POST /api/auth/logout - clears the session cookie. */
export const POST = handle(async () => {
  await destroySession();
  return json({ ok: true });
});
