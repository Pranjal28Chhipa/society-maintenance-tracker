import "server-only";

import type { Complaint, ComplaintEvent, Notice, User } from "@prisma/client";

import type {
  ComplaintCategory,
  ComplaintEventType,
  ComplaintStatus,
  Priority,
  Role,
} from "./domain";
import { evaluateOverdue, type OverdueInfo } from "./overdue";

/**
 * Row -> API shape conversion, in one place.
 *
 * Everything the API returns is built here so that (a) `passwordHash` can
 * never leak by accident, and (b) derived overdue state is attached
 * consistently on every complaint the client sees.
 */

export type ResidentRef = {
  id: string;
  name: string;
  email: string;
  flatNumber: string | null;
};

export type ComplaintEventDto = {
  id: string;
  type: ComplaintEventType;
  fromStatus: ComplaintStatus | null;
  toStatus: ComplaintStatus | null;
  fromPriority: Priority | null;
  toPriority: Priority | null;
  note: string | null;
  actor: { id: string | null; name: string; role: Role };
  createdAt: string;
};

export type ComplaintDto = {
  id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  priority: Priority;
  photoUrl: string | null;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  overdueFlaggedAt: string | null;
  overdue: OverdueInfo;
  resident: ResidentRef;
  history?: ComplaintEventDto[];
};

export type NoticeDto = {
  id: string;
  title: string;
  body: string;
  isImportant: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string | null; name: string } | null;
};

type ComplaintRow = Complaint & {
  resident: Pick<User, "id" | "name" | "email" | "flatNumber">;
  events?: (ComplaintEvent & { actor?: Pick<User, "id"> | null })[];
};

export function toComplaintDto(
  row: ComplaintRow,
  thresholdDays: number,
  now: Date = new Date(),
): ComplaintDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as ComplaintCategory,
    status: row.status as ComplaintStatus,
    priority: row.priority as Priority,
    photoUrl: row.photoUrl,
    isClosed: row.status === "RESOLVED",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    overdueFlaggedAt: row.overdueFlaggedAt?.toISOString() ?? null,
    overdue: evaluateOverdue(
      {
        status: row.status as ComplaintStatus,
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt,
        overdueFlaggedAt: row.overdueFlaggedAt,
      },
      thresholdDays,
      now,
    ),
    resident: {
      id: row.resident.id,
      name: row.resident.name,
      email: row.resident.email,
      flatNumber: row.resident.flatNumber,
    },
    ...(row.events ? { history: row.events.map(toComplaintEventDto) } : {}),
  };
}

export function toComplaintEventDto(event: ComplaintEvent): ComplaintEventDto {
  return {
    id: event.id,
    type: event.type as ComplaintEventType,
    fromStatus: (event.fromStatus as ComplaintStatus | null) ?? null,
    toStatus: (event.toStatus as ComplaintStatus | null) ?? null,
    fromPriority: (event.fromPriority as Priority | null) ?? null,
    toPriority: (event.toPriority as Priority | null) ?? null,
    note: event.note,
    actor: {
      id: event.actorId,
      name: event.actorName,
      role: event.actorRole as Role,
    },
    createdAt: event.createdAt.toISOString(),
  };
}

export function toNoticeDto(
  row: Notice & { author?: Pick<User, "id" | "name"> | null },
): NoticeDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    isImportant: row.isImportant,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    author: row.author ? { id: row.author.id, name: row.author.name } : null,
  };
}

/** Selects used across queries so every complaint response has the same shape. */
export const complaintInclude = {
  resident: { select: { id: true, name: true, email: true, flatNumber: true } },
} as const;

export const complaintDetailInclude = {
  ...complaintInclude,
  events: { orderBy: { createdAt: "asc" } },
} as const;

export const noticeInclude = {
  author: { select: { id: true, name: true } },
} as const;
