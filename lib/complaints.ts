import "server-only";

import type { Prisma } from "@prisma/client";

import type { SessionUser } from "./auth";
import { prisma } from "./db";
import {
  canTransition,
  STATUS_LABELS,
  type ComplaintCategory,
  type ComplaintStatus,
  type Priority,
} from "./domain";
import { conflict, forbidden, notFound } from "./http";
import { sendStatusChangeEmail } from "./mail";
import { compareForAdminQueue } from "./overdue";
import {
  complaintDetailInclude,
  complaintInclude,
  toComplaintDto,
  type ComplaintDto,
} from "./serialize";
import { getOverdueThresholdDays } from "./settings";

/**
 * Complaint domain logic.
 *
 * Route handlers stay thin: they parse and authorise, then call into here.
 * Every state change goes through one of these functions, which is what
 * guarantees that no status or priority can move without a matching
 * `ComplaintEvent` row being appended in the same transaction.
 */

export type ComplaintFilters = {
  status: ComplaintStatus | null;
  category: ComplaintCategory | null;
  priority: Priority | null;
  from: Date | null;
  to: Date | null;
  overdueOnly: boolean;
  search: string | null;
  page: number;
  pageSize: number;
};

export type ComplaintListResult = {
  complaints: ComplaintDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  overdueThresholdDays: number;
};

/** Builds the Prisma `where` clause shared by the resident and admin lists. */
function buildWhere(filters: ComplaintFilters, residentId?: string): Prisma.ComplaintWhereInput {
  const where: Prisma.ComplaintWhereInput = {};
  if (residentId) where.residentId = residentId;
  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.priority) where.priority = filters.priority;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return where;
}

/**
 * Lists complaints for a viewer.
 *
 * Residents implicitly get `residentId = self`; admins get everything.
 *
 * Admins are served overdue-first, which cannot be expressed as a SQL ORDER BY
 * because overdue is derived from the configurable threshold rather than
 * stored. The unresolved set in a single society is small (hundreds, not
 * millions), so the overdue-only filter and the ordering are applied in memory
 * over the page; `overdueOnly` widens the fetch first so a page is not left
 * short. The paging metadata stays accurate for the common path.
 */
export async function listComplaints(
  viewer: SessionUser,
  filters: ComplaintFilters,
): Promise<ComplaintListResult> {
  const thresholdDays = await getOverdueThresholdDays();
  const now = new Date();
  const isAdmin = viewer.role === "ADMIN";
  const where = buildWhere(filters, isAdmin ? undefined : viewer.id);

  if (!isAdmin && !filters.overdueOnly) {
    const [rows, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: complaintInclude,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.complaint.count({ where }),
    ]);

    return {
      complaints: rows.map((row) => toComplaintDto(row, thresholdDays, now)),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      overdueThresholdDays: thresholdDays,
    };
  }

  const rows = await prisma.complaint.findMany({
    where,
    include: complaintInclude,
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  let all = rows.map((row) => toComplaintDto(row, thresholdDays, now));
  if (filters.overdueOnly) all = all.filter((complaint) => complaint.overdue.isOverdue);
  if (isAdmin) all.sort(compareForAdminQueue);

  const total = all.length;
  const start = (filters.page - 1) * filters.pageSize;

  return {
    complaints: all.slice(start, start + filters.pageSize),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    overdueThresholdDays: thresholdDays,
  };
}

/** Loads one complaint with its full history. Residents may only read their own. */
export async function getComplaint(viewer: SessionUser, id: string): Promise<ComplaintDto> {
  const row = await prisma.complaint.findUnique({
    where: { id },
    include: complaintDetailInclude,
  });
  if (!row) throw notFound("Complaint not found");
  if (viewer.role !== "ADMIN" && row.residentId !== viewer.id) {
    throw forbidden("You can only view your own complaints");
  }

  const thresholdDays = await getOverdueThresholdDays();
  return toComplaintDto(row, thresholdDays);
}

/** Creates a complaint plus its opening `CREATED` history event. */
export async function createComplaint(
  resident: SessionUser,
  input: {
    title: string;
    description: string;
    category: ComplaintCategory;
    photoUrl: string | null;
  },
): Promise<ComplaintDto> {
  const created = await prisma.complaint.create({
    data: {
      residentId: resident.id,
      title: input.title,
      description: input.description,
      category: input.category,
      photoUrl: input.photoUrl,
      events: {
        create: {
          type: "CREATED",
          toStatus: "OPEN",
          toPriority: "MEDIUM",
          note: "Complaint raised",
          actorId: resident.id,
          actorName: resident.name,
          actorRole: resident.role,
        },
      },
    },
    include: complaintDetailInclude,
  });

  const thresholdDays = await getOverdueThresholdDays();
  return toComplaintDto(created, thresholdDays);
}

/**
 * Moves a complaint to a new status, appends the history event, and emails the
 * resident.
 *
 * The read-check-write runs inside a transaction so two admins acting at the
 * same time cannot both move the complaint out of the same starting status.
 */
export async function changeStatus(
  admin: SessionUser,
  id: string,
  toStatus: ComplaintStatus,
  note: string | null,
): Promise<ComplaintDto> {
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.complaint.findUnique({ where: { id } });
    if (!current) throw notFound("Complaint not found");

    const fromStatus = current.status as ComplaintStatus;
    if (fromStatus === toStatus) {
      throw conflict(`Complaint is already ${STATUS_LABELS[toStatus].toLowerCase()}`);
    }
    if (fromStatus === "RESOLVED") {
      throw conflict("This complaint is resolved and closed. Raise a new complaint instead.");
    }
    if (!canTransition(fromStatus, toStatus)) {
      throw conflict(
        `Cannot move a complaint from ${STATUS_LABELS[fromStatus]} to ${STATUS_LABELS[toStatus]}`,
      );
    }

    const becomingResolved = toStatus === "RESOLVED";

    return tx.complaint.update({
      where: { id },
      data: {
        status: toStatus,
        resolvedAt: becomingResolved ? new Date() : null,
        // Resolving closes the complaint, so any overdue flag stops applying.
        overdueFlaggedAt: becomingResolved ? null : current.overdueFlaggedAt,
        events: {
          create: {
            type: "STATUS_CHANGED",
            fromStatus,
            toStatus,
            note,
            actorId: admin.id,
            actorName: admin.name,
            actorRole: admin.role,
          },
        },
      },
      include: complaintDetailInclude,
    });
  });

  const history = updated.events;
  const event = history[history.length - 1];

  // Fire and forget: a mail failure is logged inside sendStatusChangeEmail and
  // must not turn a successful status change into a failed request.
  void sendStatusChangeEmail({
    to: updated.resident.email,
    residentName: updated.resident.name,
    complaintId: updated.id,
    title: updated.title,
    category: updated.category as ComplaintCategory,
    fromStatus: (event?.fromStatus as ComplaintStatus) ?? "OPEN",
    toStatus,
    note,
    actorName: admin.name,
  });

  const thresholdDays = await getOverdueThresholdDays();
  return toComplaintDto(updated, thresholdDays);
}

/** Changes priority and records it in history. No email - priority is internal triage. */
export async function changePriority(
  admin: SessionUser,
  id: string,
  toPriority: Priority,
): Promise<ComplaintDto> {
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.complaint.findUnique({ where: { id } });
    if (!current) throw notFound("Complaint not found");
    if (current.status === "RESOLVED") {
      throw conflict("This complaint is resolved and closed.");
    }
    if (current.priority === toPriority) return null;

    return tx.complaint.update({
      where: { id },
      data: {
        priority: toPriority,
        events: {
          create: {
            type: "PRIORITY_CHANGED",
            fromPriority: current.priority,
            toPriority,
            actorId: admin.id,
            actorName: admin.name,
            actorRole: admin.role,
          },
        },
      },
      include: complaintDetailInclude,
    });
  });

  const thresholdDays = await getOverdueThresholdDays();
  if (updated) return toComplaintDto(updated, thresholdDays);

  const unchanged = await prisma.complaint.findUniqueOrThrow({
    where: { id },
    include: complaintDetailInclude,
  });
  return toComplaintDto(unchanged, thresholdDays);
}

/** Raises or clears the explicit admin overdue flag. */
export async function setOverdueFlag(
  admin: SessionUser,
  id: string,
  flagged: boolean,
  note: string | null,
): Promise<ComplaintDto> {
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.complaint.findUnique({ where: { id } });
    if (!current) throw notFound("Complaint not found");
    if (current.status === "RESOLVED") {
      throw conflict("A resolved complaint cannot be flagged as overdue.");
    }
    if (Boolean(current.overdueFlaggedAt) === flagged) {
      throw conflict(flagged ? "Already flagged as overdue" : "Not currently flagged as overdue");
    }

    return tx.complaint.update({
      where: { id },
      data: {
        overdueFlaggedAt: flagged ? new Date() : null,
        events: {
          create: {
            type: flagged ? "OVERDUE_FLAGGED" : "OVERDUE_CLEARED",
            note,
            actorId: admin.id,
            actorName: admin.name,
            actorRole: admin.role,
          },
        },
      },
      include: complaintDetailInclude,
    });
  });

  const thresholdDays = await getOverdueThresholdDays();
  return toComplaintDto(updated, thresholdDays);
}
