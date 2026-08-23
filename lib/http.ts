import { NextResponse } from "next/server";

/** Thrown by route handlers and mapped to a JSON error body by `handle()`. */
export class ApiError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: Record<string, string>) =>
  new ApiError(400, message, details);
export const unauthorized = (message = "Not authenticated") => new ApiError(401, message);
export const forbidden = (message = "Not allowed") => new ApiError(403, message);
export const notFound = (message = "Not found") => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Wraps a route handler so thrown `ApiError`s become structured JSON and
 * anything unexpected becomes a 500 without leaking a stack trace.
 */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, ...(error.details ? { details: error.details } : {}) },
          { status: error.status },
        );
      }
      console.error("[api] unhandled error", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

/** Parses a JSON request body, rejecting anything that is not an object. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw badRequest("Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}
