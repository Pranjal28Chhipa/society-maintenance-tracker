import { PRIORITY_RANK, type ComplaintStatus, type Priority } from "./domain";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The minimum shape `evaluateOverdue` needs; both API rows and Prisma rows fit. */
export type OverdueInput = {
  status: ComplaintStatus;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  overdueFlaggedAt?: Date | string | null;
};

export type OverdueInfo = {
  /** Whole days between creation and resolution (or now, if still open). */
  ageDays: number;
  /** Instant at which the complaint crosses the threshold. */
  dueAt: string;
  /** Age is past the threshold and the complaint is not resolved. */
  isBreached: boolean;
  /** An admin has explicitly flagged this complaint. */
  isFlagged: boolean;
  /** Either condition - what the UI shows as an "Overdue" badge. */
  isOverdue: boolean;
  /** Whole days past `dueAt`, or 0 when not breached. */
  daysOverdue: number;
};

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

/**
 * Derives overdue state instead of storing it.
 *
 * Persisting an `isOverdue` boolean would need a scheduled job to stay true,
 * and would silently go stale the moment an admin changed the threshold.
 * Deriving it at read time means the threshold is retroactive by construction
 * and there is no background worker to keep alive. The one piece that *is*
 * stored is `overdueFlaggedAt`, because an explicit admin flag is a decision,
 * not a calculation.
 */
export function evaluateOverdue(
  complaint: OverdueInput,
  thresholdDays: number,
  now: Date = new Date(),
): OverdueInfo {
  const createdAt = toDate(complaint.createdAt);
  const resolvedAt = complaint.resolvedAt ? toDate(complaint.resolvedAt) : null;
  const endedAt = resolvedAt ?? now;

  const ageDays = Math.max(0, Math.floor((endedAt.getTime() - createdAt.getTime()) / DAY_MS));
  const dueAt = new Date(createdAt.getTime() + thresholdDays * DAY_MS);

  const isResolved = complaint.status === "RESOLVED";
  const isBreached = !isResolved && now.getTime() > dueAt.getTime();
  const isFlagged = Boolean(complaint.overdueFlaggedAt) && !isResolved;

  const daysOverdue = isBreached
    ? Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / DAY_MS))
    : 0;

  return {
    ageDays,
    dueAt: dueAt.toISOString(),
    isBreached,
    isFlagged,
    isOverdue: isBreached || isFlagged,
    daysOverdue,
  };
}

/**
 * Ordering for the admin queue: overdue complaints surface at the top, then
 * higher priority, then oldest first. Applied in memory because "overdue" is
 * derived and therefore not a sortable column.
 */
export function compareForAdminQueue(
  a: { overdue: OverdueInfo; priority: Priority; createdAt: string },
  b: { overdue: OverdueInfo; priority: Priority; createdAt: string },
): number {
  if (a.overdue.isOverdue !== b.overdue.isOverdue) return a.overdue.isOverdue ? -1 : 1;
  if (a.overdue.isOverdue && b.overdue.isOverdue) {
    if (a.overdue.daysOverdue !== b.overdue.daysOverdue) {
      return b.overdue.daysOverdue - a.overdue.daysOverdue;
    }
  }
  const rank = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (rank !== 0) return rank;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
