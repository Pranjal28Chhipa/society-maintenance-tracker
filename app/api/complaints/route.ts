import { requireUser } from "@/lib/auth";
import { createComplaint, listComplaints, type ComplaintFilters } from "@/lib/complaints";
import { CATEGORIES, COMPLAINT_STATUSES, PRIORITIES } from "@/lib/domain";
import { badRequest, handle, json } from "@/lib/http";
import { storePhoto } from "@/lib/storage";
import {
  boundedInt,
  enumValue,
  optionalDate,
  optionalEnum,
  optionalString,
  requiredString,
} from "@/lib/validate";

function parseFilters(url: URL): ComplaintFilters {
  const params = url.searchParams;
  return {
    status: optionalEnum(params.get("status"), COMPLAINT_STATUSES, "status"),
    category: optionalEnum(params.get("category"), CATEGORIES, "category"),
    priority: optionalEnum(params.get("priority"), PRIORITIES, "priority"),
    from: optionalDate(params.get("from"), "from"),
    to: optionalDate(params.get("to"), "to"),
    overdueOnly: params.get("overdue") === "true",
    search: optionalString(params.get("search"), "search", { max: 120 }),
    page: boundedInt(params.get("page"), "page", { min: 1, max: 10_000, fallback: 1 }),
    pageSize: boundedInt(params.get("pageSize"), "pageSize", { min: 1, max: 100, fallback: 20 }),
  };
}

/**
 * GET /api/complaints - list complaints visible to the caller.
 *
 * Residents always see only their own; the filters below are the admin view.
 * Query: status, category, priority, from, to, overdue, search, page, pageSize.
 */
export const GET = handle(async (request: Request) => {
  const user = await requireUser();
  const result = await listComplaints(user, parseFilters(new URL(request.url)));
  return json(result);
});

/**
 * POST /api/complaints - raise a complaint.
 *
 * Accepts `multipart/form-data` (with an optional `photo` file) or plain JSON.
 * Handling the upload in the same request keeps the row and its photo atomic:
 * there is no window where a complaint exists pointing at a photo that was
 * never finished uploading.
 */
export const POST = handle(async (request: Request) => {
  const user = await requireUser();
  const contentType = request.headers.get("content-type") ?? "";

  let title: string;
  let description: string;
  let category: string;
  let photoUrl: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    title = requiredString(form.get("title"), "title", { min: 4, max: 140 });
    description = requiredString(form.get("description"), "description", { min: 10, max: 4000 });
    category = String(form.get("category") ?? "");

    const photo = form.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const stored = await storePhoto(photo);
      photoUrl = stored.url;
    }
  } else if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw badRequest("Request body must be valid JSON");
    title = requiredString(body.title, "title", { min: 4, max: 140 });
    description = requiredString(body.description, "description", { min: 10, max: 4000 });
    category = String(body.category ?? "");
    photoUrl = optionalString(body.photoUrl, "photoUrl", { max: 2000 });
  } else {
    throw badRequest("Content-Type must be multipart/form-data or application/json");
  }

  const complaint = await createComplaint(user, {
    title,
    description,
    category: enumValue(category, CATEGORIES, "category"),
    photoUrl,
  });

  return json({ complaint }, 201);
});
