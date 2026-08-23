import "server-only";

import { prisma } from "./db";
import {
  CATEGORIES,
  COMPLAINT_STATUSES,
  PRIORITIES,
  type ComplaintCategory,
  type ComplaintStatus,
  type Priority,
} from "./domain";
import { evaluateOverdue } from "./overdue";
import { getOverdueThresholdDays } from "./settings";

export type DashboardData = {
  overdueThresholdDays: number;
  totals: {
    all: number;
    open: number;
    inProgress: number;
    resolved: number;
    overdue: number;
    unresolved: number;
  };
  byStatus: { status: ComplaintStatus; count: number }[];
  byCategory: { category: ComplaintCategory; count: number; open: number }[];
  byPriority: { priority: Priority; count: number }[];
  /** Mean days from raised to resolved, over resolved complaints. Null if none. */
  averageResolutionDays: number | null;
  /** Complaints raised per day for the last 14 days, oldest first. */
  trend: { date: string; raised: number; resolved: number }[];
  oldestOverdue: {
    id: string;
    title: string;
    daysOverdue: number;
    priority: Priority;
    residentName: string;
  }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Builds the admin dashboard.
 *
 * Counts come from grouped queries; only the overdue figures need row-level
 * work, because overdue is derived from the configurable threshold rather than
 * stored. That scan is restricted to unresolved complaints, which is the only
 * set that can be overdue.
 */
export async function getDashboard(): Promise<DashboardData> {
  const thresholdDays = await getOverdueThresholdDays();
  const now = new Date();
  const trendStart = new Date(now.getTime() - 13 * DAY_MS);
  trendStart.setHours(0, 0, 0, 0);

  const [statusGroups, categoryGroups, priorityGroups, unresolved, resolvedRows, recentRows] =
    await Promise.all([
      prisma.complaint.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.complaint.groupBy({ by: ["category", "status"], _count: { _all: true } }),
      prisma.complaint.groupBy({ by: ["priority"], _count: { _all: true } }),
      prisma.complaint.findMany({
        where: { status: { not: "RESOLVED" } },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          overdueFlaggedAt: true,
          resident: { select: { name: true } },
        },
      }),
      prisma.complaint.findMany({
        where: { status: "RESOLVED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
      prisma.complaint.findMany({
        where: { OR: [{ createdAt: { gte: trendStart } }, { resolvedAt: { gte: trendStart } }] },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

  const statusCount = (status: ComplaintStatus) =>
    statusGroups.find((group) => group.status === status)?._count._all ?? 0;

  const overdue = unresolved
    .map((row) => ({
      row,
      info: evaluateOverdue(
        {
          status: row.status as ComplaintStatus,
          createdAt: row.createdAt,
          overdueFlaggedAt: row.overdueFlaggedAt,
        },
        thresholdDays,
        now,
      ),
    }))
    .filter((entry) => entry.info.isOverdue);

  const averageResolutionDays = resolvedRows.length
    ? Number(
        (
          resolvedRows.reduce(
            (sum, row) => sum + (row.resolvedAt!.getTime() - row.createdAt.getTime()),
            0,
          ) /
          resolvedRows.length /
          DAY_MS
        ).toFixed(1),
      )
    : null;

  // Built from local date parts, not toISOString(). Taking the ISO string of a
  // local midnight re-projects it to UTC, which shifts every bucket back a day
  // for any timezone ahead of UTC - the chart would be labelled yesterday.
  const dayKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;

  const trend = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(trendStart.getTime() + index * DAY_MS);
    const key = dayKey(day);
    return {
      date: key,
      raised: recentRows.filter((row) => dayKey(row.createdAt) === key).length,
      resolved: recentRows.filter((row) => row.resolvedAt && dayKey(row.resolvedAt) === key).length,
    };
  });

  return {
    overdueThresholdDays: thresholdDays,
    totals: {
      all: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
      open: statusCount("OPEN"),
      inProgress: statusCount("IN_PROGRESS"),
      resolved: statusCount("RESOLVED"),
      overdue: overdue.length,
      unresolved: unresolved.length,
    },
    byStatus: COMPLAINT_STATUSES.map((status) => ({ status, count: statusCount(status) })),
    byCategory: CATEGORIES.map((category) => {
      const rows = categoryGroups.filter((group) => group.category === category);
      return {
        category,
        count: rows.reduce((sum, group) => sum + group._count._all, 0),
        open: rows
          .filter((group) => group.status !== "RESOLVED")
          .reduce((sum, group) => sum + group._count._all, 0),
      };
    }).filter((entry) => entry.count > 0),
    byPriority: PRIORITIES.map((priority) => ({
      priority,
      count: priorityGroups.find((group) => group.priority === priority)?._count._all ?? 0,
    })),
    averageResolutionDays,
    trend,
    oldestOverdue: overdue
      .sort((a, b) => b.info.daysOverdue - a.info.daysOverdue)
      .slice(0, 5)
      .map((entry) => ({
        id: entry.row.id,
        title: entry.row.title,
        daysOverdue: entry.info.daysOverdue,
        priority: entry.row.priority as Priority,
        residentName: entry.row.resident.name,
      })),
  };
}
