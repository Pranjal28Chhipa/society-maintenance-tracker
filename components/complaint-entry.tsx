import Link from "next/link";

import { entryRef, timeAgo } from "@/lib/format";
import type { ComplaintDto } from "@/lib/serialize";

import { CategoryTag, OverdueStamp, PriorityTag, StatusTag } from "./badges";

/**
 * One row of the register.
 *
 * The gutter holds the entry reference behind a red margin rule - the same
 * rule that runs down a physical complaint book. Overdue entries carry the
 * stamp and a tinted margin so they read as urgent from across the list.
 */
export function ComplaintEntry({
  complaint,
  href,
  showResident = false,
  index = 0,
}: {
  complaint: ComplaintDto;
  href: string;
  showResident?: boolean;
  index?: number;
}) {
  const overdue = complaint.overdue.isOverdue;

  return (
    <li className="rise" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
      <Link
        href={href}
        className="group sheet flex gap-0 overflow-hidden transition-colors hover:border-ink-faint"
      >
        <div
          className={`flex w-14 shrink-0 flex-col items-center gap-1.5 border-r-2 py-4 sm:w-16 ${
            overdue ? "border-r-stamp-red bg-stamp-red-soft/45" : "border-r-stamp-red/35 bg-sheet-sunk/60"
          }`}
        >
          <span className="font-mono text-[10px] tracking-[0.1em] text-ink-faint">No.</span>
          <span className="font-mono text-[11px] font-semibold tracking-tight text-ink-soft">
            {entryRef(complaint.id)}
          </span>
        </div>

        <div className="min-w-0 flex-1 px-4 py-3.5 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-[0.95rem] leading-snug font-semibold text-balance text-ink group-hover:text-stamp-blue">
              {complaint.title}
            </h3>
            {overdue ? (
              <span className="mt-0.5 shrink-0">
                <OverdueStamp overdue={complaint.overdue} />
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 line-clamp-2 font-serif text-sm leading-relaxed text-ink-soft">
            {complaint.description}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusTag status={complaint.status} />
            <PriorityTag priority={complaint.priority} />
            <CategoryTag category={complaint.category} />
            {complaint.photoUrl ? (
              <span className="tag bg-sheet-sunk text-ink-faint ring-1 ring-rule">Photo</span>
            ) : null}
          </div>

          <p className="mt-2.5 font-mono text-[11px] tracking-wide text-ink-faint">
            {showResident ? (
              <>
                {complaint.resident.name}
                {complaint.resident.flatNumber ? ` · ${complaint.resident.flatNumber}` : ""}
                {" · "}
              </>
            ) : null}
            Raised {timeAgo(complaint.createdAt)}
            {complaint.status === "RESOLVED" && complaint.resolvedAt
              ? ` · Closed ${timeAgo(complaint.resolvedAt)}`
              : ` · ${complaint.overdue.ageDays}d open`}
          </p>
        </div>
      </Link>
    </li>
  );
}
