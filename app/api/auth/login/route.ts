import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handle, json, readJson, unauthorized } from "@/lib/http";
import type { Role } from "@/lib/domain";

/** POST /api/auth/login - exchanges credentials for an httpOnly session cookie. */
export const POST = handle(async (request: Request) => {
  const body = await readJson(request);
  const emailInput = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const passwordInput = typeof body.password === "string" ? body.password : "";

  const user = await prisma.user.findUnique({ where: { email: emailInput } });

  // Same message and roughly the same work either way, so the response does
  // not reveal whether an address is registered.
  const ok = user
    ? await verifyPassword(passwordInput, user.passwordHash)
    : await verifyPassword(passwordInput, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");

  if (!user || !ok) throw unauthorized("Incorrect email or password");

  await createSession(user.id, user.role as Role);

  return json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      flatNumber: user.flatNumber,
    },
  });
});
