import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ComplaintEntry } from "@/components/complaint-entry";
import { ComplaintFilters } from "@/components/complaint-filters";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listComplaints } from "@/lib/complaints";
import { CATEGORIES, COMPLAINT_STATUSES, PRIORITIES } from "@/lib/domain";
import { pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "Complaint queue" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

const pick = <T extends string>(value: string | undefined, allowed: readonly T[]) =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : null;

const asDate = (value: string | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * The office queue.
 *
 * Ordered overdue-first, then by priority, then oldest - so the top of this
 * page is always the thing that has been waiting longest without attention.
 */
export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, Number(query.page ?? 1) || 1);

  const result = await listComplaints(admin, {
    status: pick(query.status, COMPLAINT_STATUSES),
    category: pick(query.category, CATEGORIES),
    priority: pick(query.priority, PRIORITIES),
    from: asDate(query.from),
    to: asDate(query.to),
    overdueOnly: query.overdue === "true",
    search: query.search?.trim() || null,
    page,
    pageSize: 20,
  });

  const overdueOnPage = result.complaints.filter((c) => c.overdue.isOverdue).length;

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value && key !== "page") next.set(key, value);
    }
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return qs ? `/admin/complaints?${qs}` : "/admin/complaints";
  };

  return (
    <>
      <PageHeader
        eyebrow="Office register"
        title="Complaint queue"
        description={`Overdue first, then priority, then oldest. A complaint goes overdue after ${pluralise(result.overdueThresholdDays, "day")} unresolved.`}
      />

      <Suspense fallback={<div className="sheet mb-6 h-56 animate-pulse" />}>
        <ComplaintFilters resultCount={result.total} />
      </Suspense>

      {overdueOnPage > 0 ? (
        <p className="mb-4 flex items-center gap-2.5 border-l-[3px] border-stamp-red bg-stamp-red-soft/55 px-4 py-2.5 text-sm font-medium text-stamp-red">
          {pluralise(overdueOnPage, "complaint")} on this page{" "}
          {overdueOnPage === 1 ? "is" : "are"} overdue and{" "}
          {overdueOnPage === 1 ? "sits" : "sit"} at the top.
        </p>
      ) : null}

      {result.complaints.length === 0 ? (
        <EmptyState
          title="Nothing matches these filters"
          description="Widen the date range or clear a filter to see more of the register."
        />
      ) : (
        <ul className="space-y-2.5">
          {result.complaints.map((complaint, index) => (
            <ComplaintEntry
              key={complaint.id}
              complaint={complaint}
              href={`/complaints/${complaint.id}`}
              showResident
              index={index}
            />
          ))}
        </ul>
      )}

      {result.totalPages > 1 ? (
        <nav
          aria-label="Pages"
          className="mt-7 flex items-center justify-between border-t border-rule pt-5"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="text-sm font-semibold text-stamp-blue hover:text-ink"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-[11px] tracking-wide text-ink-faint">
            Page {page} of {result.totalPages}
          </span>
          {page < result.totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="text-sm font-semibold text-stamp-blue hover:text-ink"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
