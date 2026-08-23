import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminComplaintActions } from "@/components/admin-complaint-actions";
import { CategoryTag, OverdueStamp, PriorityTag, ResolvedStamp, StatusTag } from "@/components/badges";
import { HistoryTimeline } from "@/components/history-timeline";
import { DataRow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getComplaint } from "@/lib/complaints";
import { entryRef, formatDate, formatDateTime, pluralise } from "@/lib/format";
import { ApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return { title: `Complaint ${entryRef(id)}` };
}

/**
 * One entry, in full. The same page serves residents and the office - the
 * office simply gets the actions column. Authorisation is enforced in
 * `getComplaint`, which is the same check the API route runs.
 */
export default async function ComplaintDetailPage({ params }: Params) {
  const user = await requireUser();
  const { id } = await params;

  const complaint = await getComplaint(user, id).catch((error) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  });

  const isAdmin = user.role === "ADMIN";
  const backHref = isAdmin ? "/admin/complaints" : "/complaints";

  return (
    <>
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-ink-faint uppercase transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span> {isAdmin ? "Complaint queue" : "My complaints"}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          <article className="sheet overflow-hidden">
            <div className="flex gap-0">
              <div
                className={`flex w-14 shrink-0 flex-col items-center gap-1.5 border-r-2 py-5 sm:w-16 ${
                  complaint.overdue.isOverdue
                    ? "border-r-stamp-red bg-stamp-red-soft/45"
                    : "border-r-stamp-red/35 bg-sheet-sunk/60"
                }`}
              >
                <span className="font-mono text-[10px] tracking-[0.1em] text-ink-faint">No.</span>
                <span className="font-mono text-[11px] font-semibold text-ink-soft">
                  {entryRef(complaint.id)}
                </span>
              </div>

              <div className="min-w-0 flex-1 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h1 className="min-w-0 text-xl leading-snug font-bold tracking-tight text-balance text-ink sm:text-2xl">
                    {complaint.title}
                  </h1>
                  <span className="shrink-0">
                    {complaint.status === "RESOLVED" ? (
                      <ResolvedStamp />
                    ) : (
                      <OverdueStamp overdue={complaint.overdue} />
                    )}
                  </span>
                </div>

                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  <StatusTag status={complaint.status} />
                  <PriorityTag priority={complaint.priority} />
                  <CategoryTag category={complaint.category} />
                </div>

                <p className="prose-entry mt-5">{complaint.description}</p>
              </div>
            </div>

            {complaint.photoUrl ? (
              <figure className="border-t border-rule bg-sheet-sunk/60 p-5 sm:p-6">
                <figcaption className="eyebrow mb-3">Photo attached by the resident</figcaption>
                {/* Photos come from Vercel Blob or the local uploads folder; both are
                    plain URLs, so a plain img avoids configuring remote patterns. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={complaint.photoUrl}
                  alt={`Photo attached to the complaint: ${complaint.title}`}
                  className="max-h-[28rem] w-full rounded-[2px] border border-rule bg-sheet object-contain"
                />
              </figure>
            ) : null}
          </article>

          <section className="sheet p-5 sm:p-6">
            <h2 className="eyebrow mb-1">Status history</h2>
            <p className="mb-4 text-sm text-ink-soft">
              {pluralise(complaint.history?.length ?? 0, "change")} recorded, oldest first.
            </p>
            <HistoryTimeline history={complaint.history ?? []} />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="sheet p-5">
            <p className="eyebrow mb-2.5">Entry details</p>
            <dl>
              <DataRow label="Raised">{formatDateTime(complaint.createdAt)}</DataRow>
              {isAdmin ? (
                <DataRow label="Resident">
                  {complaint.resident.name}
                  {complaint.resident.flatNumber ? (
                    <span className="block font-mono text-[11px] text-ink-faint">
                      {complaint.resident.flatNumber} · {complaint.resident.email}
                    </span>
                  ) : null}
                </DataRow>
              ) : null}
              <DataRow label="Age">{pluralise(complaint.overdue.ageDays, "day")}</DataRow>
              <DataRow label="Due by">{formatDate(complaint.overdue.dueAt)}</DataRow>
              {complaint.resolvedAt ? (
                <DataRow label="Closed">{formatDateTime(complaint.resolvedAt)}</DataRow>
              ) : null}
              {complaint.overdueFlaggedAt ? (
                <DataRow label="Flagged">{formatDate(complaint.overdueFlaggedAt)}</DataRow>
              ) : null}
            </dl>
          </div>

          {isAdmin ? (
            <AdminComplaintActions complaint={complaint} />
          ) : (
            <div className="sheet p-5">
              <p className="eyebrow mb-2.5">What happens next</p>
              <p className="text-sm leading-relaxed text-ink-soft">
                {complaint.status === "RESOLVED"
                  ? "This complaint is closed. If the problem comes back, raise a new one so it gets a fresh entry and its own history."
                  : "The office updates the status as work progresses. You will get an email at each change, and every update appears in the history above."}
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
