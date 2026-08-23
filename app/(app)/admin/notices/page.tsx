import type { Metadata } from "next";

import { NoticeActions } from "@/components/notice-actions";
import { NoticeCard } from "@/components/notice-card";
import { NoticeComposer } from "@/components/notice-composer";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { noticeInclude, toNoticeDto } from "@/lib/serialize";

export const metadata: Metadata = { title: "Notices" };
export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  await requireAdmin();

  const [notices, residentCount] = await Promise.all([
    prisma.notice.findMany({
      include: noticeInclude,
      orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.user.count({ where: { role: "RESIDENT" } }),
  ]);

  const board = notices.map(toNoticeDto);

  return (
    <>
      <PageHeader
        eyebrow="Notice board"
        title="Notices"
        description="Important notices are pinned to the top of the board and emailed to every resident. Everything else simply sits on the board."
      />

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <NoticeComposer residentCount={residentCount} />
        </div>

        <div className="space-y-4">
          <h2 className="eyebrow">On the board · {board.length}</h2>

          {board.length === 0 ? (
            <EmptyState
              title="Nothing posted yet"
              description="Post the first notice and it appears here and on every resident's board."
            />
          ) : (
            board.map((notice, index) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                index={index}
                action={<NoticeActions noticeId={notice.id} isImportant={notice.isImportant} />}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
