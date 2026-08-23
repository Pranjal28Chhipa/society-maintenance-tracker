import { badRequest } from "./http";

/**
 * A deliberately small validation helper. The assignment asks for minimal
 * dependencies, and the payloads here are shallow enough that a schema library
 * would cost more than it saves. Every function throws `ApiError(400)` with a
 * field-keyed `details` map so the client can render inline errors.
 */

type Fields = Record<string, string>;

export class FieldErrors {
  private errors: Fields = {};

  add(field: string, message: string) {
    if (!this.errors[field]) this.errors[field] = message;
    return this;
  }

  get isEmpty() {
    return Object.keys(this.errors).length === 0;
  }

  throwIfAny(message = "Validation failed"): void {
    if (!this.isEmpty) throw badRequest(message, this.errors);
  }
}

export function requiredString(
  value: unknown,
  field: string,
  { min = 1, max = 5000 }: { min?: number; max?: number } = {},
): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < min) {
    throw badRequest("Validation failed", {
      [field]: min === 1 ? `${field} is required` : `${field} must be at least ${min} characters`,
    });
  }
  if (text.length > max) {
    throw badRequest("Validation failed", {
      [field]: `${field} must be at most ${max} characters`,
    });
  }
  return text;
}

export function optionalString(
  value: unknown,
  field: string,
  { max = 5000 }: { max?: number } = {},
): string | null {
  if (value === undefined || value === null || value === "") return null;
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (text.length > max) {
    throw badRequest("Validation failed", {
      [field]: `${field} must be at most ${max} characters`,
    });
  }
  return text;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function email(value: unknown, field = "email"): string {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(text)) {
    throw badRequest("Validation failed", { [field]: "Enter a valid email address" });
  }
  return text;
}

export function password(value: unknown, field = "password"): string {
  const text = typeof value === "string" ? value : "";
  if (text.length < 8) {
    throw badRequest("Validation failed", {
      [field]: "Password must be at least 8 characters",
    });
  }
  if (text.length > 200) {
    throw badRequest("Validation failed", { [field]: "Password is too long" });
  }
  return text;
}

export function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw badRequest("Validation failed", {
    [field]: `${field} must be one of: ${allowed.join(", ")}`,
  });
}

export function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | null {
  if (value === undefined || value === null || value === "") return null;
  return enumValue(value, allowed, field);
}

export function boundedInt(
  value: unknown,
  field: string,
  { min, max, fallback }: { min: number; max: number; fallback?: number },
): number {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : Number(String(value));
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw badRequest("Validation failed", {
      [field]: `${field} must be a whole number between ${min} and ${max}`,
    });
  }
  return parsed;
}

/** Parses a YYYY-MM-DD or ISO date string from a query parameter. */
export function optionalDate(value: string | null, field: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest("Validation failed", { [field]: `${field} must be a valid date` });
  }
  return parsed;
}
