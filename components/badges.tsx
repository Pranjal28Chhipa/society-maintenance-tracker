import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type ComplaintCategory,
  type ComplaintStatus,
  type Priority,
} from "@/lib/domain";
import type { OverdueInfo } from "@/lib/overdue";

/**
 * Status vocabulary.
 *
 * Resolved and overdue are stamped - those are the two states someone scans a
 * long queue for. Everything else is a quiet tag, so the stamps keep their
 * meaning.
 */

const STATUS_STYLES: Record<ComplaintStatus, string> = {
  OPEN: "bg-sheet-sunk text-ink-soft ring-1 ring-rule",
  IN_PROGRESS: "bg-stamp-blue-soft text-stamp-blue ring-1 ring-stamp-blue/25",
  RESOLVED: "bg-stamp-green-soft text-stamp-green ring-1 ring-stamp-green/25",
};

export function StatusTag({ status }: { status: ComplaintStatus }) {
  return (
    <span className={`tag ${STATUS_STYLES[status]}`}>
      {status === "IN_PROGRESS" ? (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      ) : null}
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  HIGH: "bg-stamp-red-soft text-stamp-red ring-1 ring-stamp-red/25",
  MEDIUM: "bg-stamp-amber-soft text-stamp-amber ring-1 ring-stamp-amber/25",
  LOW: "bg-sheet-sunk text-ink-faint ring-1 ring-rule",
};

/** Three ticks, filled to the priority level - readable without the label. */
export function PriorityTag({ priority }: { priority: Priority }) {
  const filled = priority === "HIGH" ? 3 : priority === "MEDIUM" ? 2 : 1;
  return (
    <span className={`tag ${PRIORITY_STYLES[priority]}`}>
      <span aria-hidden className="flex items-end gap-[2px]">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="w-[3px] rounded-[1px] bg-current"
            style={{ height: `${5 + index * 2}px`, opacity: index < filled ? 1 : 0.22 }}
          />
        ))}
      </span>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function CategoryTag({ category }: { category: ComplaintCategory }) {
  return (
    <span className="tag bg-manila-deep/45 text-ink-soft ring-1 ring-rule">
      {CATEGORY_LABELS[category]}
    </span>
  );
}

/**
 * The overdue stamp. Distinguishes the two ways a complaint gets here:
 * an admin flagged it by hand, or it aged past the configured threshold.
 */
export function OverdueStamp({ overdue }: { overdue: OverdueInfo }) {
  if (!overdue.isOverdue) return null;

  const label = overdue.isBreached
    ? `Overdue · ${overdue.daysOverdue}d`
    : "Flagged overdue";

  const title = overdue.isBreached
    ? `Unresolved ${overdue.daysOverdue} day${overdue.daysOverdue === 1 ? "" : "s"} past the threshold`
    : "Flagged as overdue by the admin";

  return (
    <span className="stamp stamp-red" title={title}>
      {label}
    </span>
  );
}

export function ResolvedStamp() {
  return <span className="stamp stamp-green">Resolved</span>;
}
