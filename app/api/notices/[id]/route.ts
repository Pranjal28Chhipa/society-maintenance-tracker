import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handle, json, notFound, readJson } from "@/lib/http";
import { sendImportantNoticeEmails } from "@/lib/mail";
import { noticeInclude, toNoticeDto } from "@/lib/serialize";
import { optionalString } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/notices/:id - edit a notice.
 *
 * Residents are emailed only when a notice becomes important, so re-saving an
 * already-important notice does not re-notify the whole society.
 */
export const PATCH = handle(async (request: Request, { params }: Params) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const payload = await readJson(request);

  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing) throw notFound("Notice not found");

  const title = optionalString(payload.title, "title", { max: 140 }) ?? existing.title;
  const body = optionalString(payload.body, "body", { max: 8000 }) ?? existing.body;
  const isImportant =
    typeof payload.isImportant === "boolean" ? payload.isImportant : existing.isImportant;

  const notice = await prisma.notice.update({
    where: { id },
    data: { title, body, isImportant },
    include: noticeInclude,
  });

  if (isImportant && !existing.isImportant) {
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

  return json({ notice: toNoticeDto(notice) });
});

/** DELETE /api/notices/:id - remove a notice from the board. */
export const DELETE = handle(async (_request: Request, { params }: Params) => {
  await requireAdmin();
  const { id } = await params;

  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing) throw notFound("Notice not found");

  await prisma.notice.delete({ where: { id } });
  return json({ ok: true });
});
