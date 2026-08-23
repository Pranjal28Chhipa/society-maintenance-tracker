import { requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handle, json, readJson } from "@/lib/http";
import { sendImportantNoticeEmails } from "@/lib/mail";
import { noticeInclude, toNoticeDto } from "@/lib/serialize";
import { boundedInt, requiredString } from "@/lib/validate";

/**
 * GET /api/notices - the notice board, visible to any signed-in user.
 *
 * Important notices are pinned: ordering is `isImportant desc, createdAt desc`,
 * which the composite index `(isImportant, createdAt)` serves directly.
 */
export const GET = handle(async (request: Request) => {
  await requireUser();
  const params = new URL(request.url).searchParams;
  const limit = boundedInt(params.get("limit"), "limit", { min: 1, max: 100, fallback: 50 });

  const notices = await prisma.notice.findMany({
    include: noticeInclude,
    orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return json({ notices: notices.map(toNoticeDto) });
});

/**
 * POST /api/notices - admin posts a notice.
 *
 * Body: `{ title, body, isImportant? }`. Marking it important pins it to the
 * top of the board and emails every resident.
 */
export const POST = handle(async (request: Request) => {
  const admin = await requireAdmin();
  const payload = await readJson(request);

  const notice = await prisma.notice.create({
    data: {
      title: requiredString(payload.title, "title", { min: 4, max: 140 }),
      body: requiredString(payload.body, "body", { min: 10, max: 8000 }),
      isImportant: payload.isImportant === true,
      authorId: admin.id,
    },
    include: noticeInclude,
  });

  if (notice.isImportant) {
    const residents = await prisma.user.findMany({
      where: { role: "RESIDENT" },
      select: { email: true, name: true },
    });
    void sendImportantNoticeEmails({
      recipients: residents,
      title: notice.title,
      body: notice.body,
      authorName: admin.name,
    });
  }

  return json({ notice: toNoticeDto(notice) }, 201);
});
