import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { conflict, handle, json, readJson } from "@/lib/http";
import { email, optionalString, password, requiredString } from "@/lib/validate";

/**
 * POST /api/auth/register - self-service resident sign-up.
 *
 * Admin accounts are never created here; they are seeded (`npm run db:seed`)
 * or promoted directly in the database, so the public endpoint cannot be used
 * to mint one.
 */
export const POST = handle(async (request: Request) => {
  const body = await readJson(request);

  const data = {
    name: requiredString(body.name, "name", { min: 2, max: 120 }),
    email: email(body.email),
    passwordHash: await hashPassword(password(body.password)),
    flatNumber: optionalString(body.flatNumber, "flatNumber", { max: 30 }),
    phone: optionalString(body.phone, "phone", { max: 30 }),
    role: "RESIDENT" as const,
  };

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw conflict("An account with this email already exists");

  const user = await prisma.user.create({
    data,
    select: { id: true, email: true, name: true, role: true, flatNumber: true },
  });

  await createSession(user.id, "RESIDENT");
  return json({ user }, 201);
});
