import type { Metadata } from "next";

import { NoticeCard } from "@/components/notice-card";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { noticeInclude, toNoticeDto } from "@/lib/serialize";

export const metadata: Metadata = { title: "Notice board" };
export const dynamic = "force-dynamic";

export default async function NoticeBoardPage() {
  await requireUser();

  const notices = await prisma.notice.findMany({
    include: noticeInclude,
    orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const board = notices.map(toNoticeDto);
  const pinned = board.filter((notice) => notice.isImportant);
  const rest = board.filter((notice) => !notice.isImportant);

  return (
    <>
      <PageHeader
        eyebrow="Society notice board"
        title="Notices"
        description="Announcements from the society office. Important notices are pinned here and emailed to every resident."
      />

      {board.length === 0 ? (
        <EmptyState
          title="The board is empty"
          description="When the office posts an announcement, it appears here."
        />
      ) : (
        <div className="space-y-8">
          {pinned.length > 0 ? (
            <section className="space-y-4">
              {pinned.map((notice, index) => (
                <NoticeCard key={notice.id} notice={notice} index={index} />
              ))}
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section className="space-y-4">
              {pinned.length > 0 ? (
                <h2 className="eyebrow border-t border-rule pt-6">Earlier notices</h2>
              ) : null}
              {rest.map((notice, index) => (
                <NoticeCard key={notice.id} notice={notice} index={index + pinned.length} />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
