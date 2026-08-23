import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

import { prisma } from "./db";
import { env } from "./env";
import { forbidden, unauthorized } from "./http";
import type { Role } from "./domain";

const COOKIE_NAME = "smt_session";
const SESSION_DAYS = 7;
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;

/** Public shape of the signed-in user, safe to send to the client. */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  flatNumber: string | null;
};

function secretKey(): Uint8Array {
  if (env.authSecret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(env.authSecret);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Signs a session JWT and writes it as an httpOnly cookie. */
export async function createSession(userId: string, role: Role) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Reads and verifies the session cookie, then loads the user.
 *
 * The user is re-read from the database on every request rather than trusted
 * from the token, so a role change or a deleted account takes effect
 * immediately instead of at token expiry.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    userId = payload.sub;
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, flatNumber: true },
  });

  return user ?? null;
}

/** Throws 401 unless a valid session exists. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** Throws 401 without a session, 403 for a signed-in non-admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw forbidden("Admin access required");
  return user;
}
