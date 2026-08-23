/**
 * Shared domain vocabulary.
 *
 * Plain string unions rather than re-exported Prisma enums, because these are
 * imported by Client Components too and `@prisma/client` cannot be bundled for
 * the browser. The literals are identical to the enum members in
 * `prisma/schema.prisma`, so they are structurally assignable in both
 * directions.
 */

export const ROLES = ["RESIDENT", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const COMPLAINT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = [
  "PLUMBING",
  "ELECTRICAL",
  "LIFT",
  "HOUSEKEEPING",
  "SECURITY",
  "PARKING",
  "COMMON_AREA",
  "OTHER",
] as const;
export type ComplaintCategory = (typeof CATEGORIES)[number];

export const EVENT_TYPES = [
  "CREATED",
  "STATUS_CHANGED",
  "PRIORITY_CHANGED",
  "OVERDUE_FLAGGED",
  "OVERDUE_CLEARED",
  "NOTE_ADDED",
] as const;
export type ComplaintEventType = (typeof EVENT_TYPES)[number];

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  LIFT: "Lift / elevator",
  HOUSEKEEPING: "Housekeeping",
  SECURITY: "Security",
  PARKING: "Parking",
  COMMON_AREA: "Common area",
  OTHER: "Other",
};

/** Rank used to sort the admin queue: higher priority floats up. */
export const PRIORITY_RANK: Record<Priority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Allowed status transitions.
 *
 * RESOLVED is terminal - the assignment states that a resolved complaint is
 * closed - so it maps to an empty list and every attempted transition out of
 * it is rejected with 409.
 */
export const STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["OPEN", "RESOLVED"],
  RESOLVED: [],
};

export function canTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export const TERMINAL_STATUS: ComplaintStatus = "RESOLVED";
