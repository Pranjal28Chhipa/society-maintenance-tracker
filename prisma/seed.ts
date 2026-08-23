/**
 * Seeds a demo society: one admin, four residents, a spread of complaints in
 * every state (including some deliberately backdated so the overdue rules have
 * something to catch), and a few notices.
 *
 * Safe to re-run: it upserts users by email and skips complaint seeding if
 * complaints already exist.
 */
import { PrismaClient, type ComplaintCategory, type Priority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@society.test";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
const RESIDENT_PASSWORD = "Resident@123";

async function main() {
  const [adminHash, residentHash] = await Promise.all([
    bcrypt.hash(ADMIN_PASSWORD, 10),
    bcrypt.hash(RESIDENT_PASSWORD, 10),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN" },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: adminHash,
      name: "Society Admin",
      role: "ADMIN",
      flatNumber: "Office",
    },
  });

  const residentSeeds = [
    { email: "priya@society.test", name: "Priya Nair", flatNumber: "A-204" },
    { email: "rahul@society.test", name: "Rahul Mehta", flatNumber: "B-1102" },
    { email: "anita@society.test", name: "Anita Desai", flatNumber: "C-305" },
    { email: "vikram@society.test", name: "Vikram Rao", flatNumber: "A-701" },
  ];

  const residents = [];
  for (const seed of residentSeeds) {
    residents.push(
      await prisma.user.upsert({
        where: { email: seed.email },
        update: {},
        create: { ...seed, passwordHash: residentHash, role: "RESIDENT" },
      }),
    );
  }

  await prisma.setting.upsert({
    where: { key: "overdue_threshold_days" },
    update: {},
    create: { key: "overdue_threshold_days", value: String(process.env.OVERDUE_THRESHOLD_DAYS || 5) },
  });

  const existingComplaints = await prisma.complaint.count();
  if (existingComplaints > 0) {
    console.log(`Skipping complaint seed - ${existingComplaints} already present.`);
    console.log(summary());
    return;
  }

  type Seed = {
    resident: (typeof residents)[number];
    title: string;
    description: string;
    category: ComplaintCategory;
    priority: Priority;
    ageDays: number;
    /** Timeline applied after creation, in order. */
    steps: { status: "IN_PROGRESS" | "RESOLVED"; note: string; afterDays: number }[];
    flagOverdue?: boolean;
  };

  const seeds: Seed[] = [
    {
      resident: residents[0],
      title: "Kitchen tap leaking continuously",
      description:
        "The kitchen tap in A-204 has been dripping since Monday and the drip has turned into a steady stream overnight. The cabinet below is getting soaked.",
      category: "PLUMBING",
      priority: "HIGH",
      ageDays: 12,
      steps: [{ status: "IN_PROGRESS", note: "Plumber scheduled for Thursday morning.", afterDays: 2 }],
      flagOverdue: true,
    },
    {
      resident: residents[1],
      title: "Lift B stuck between floors 7 and 8",
      description:
        "Lift B jerked and stopped between the 7th and 8th floor this morning. Two residents were inside for about ten minutes before the doors opened.",
      category: "LIFT",
      priority: "HIGH",
      ageDays: 9,
      steps: [{ status: "IN_PROGRESS", note: "Otis technician called out, awaiting spare part.", afterDays: 1 }],
    },
    {
      resident: residents[2],
      title: "Corridor lights out on 3rd floor",
      description:
        "All four tube lights in the C-wing 3rd floor corridor have been off for three days. It is completely dark after 7pm.",
      category: "ELECTRICAL",
      priority: "MEDIUM",
      ageDays: 7,
      steps: [],
    },
    {
      resident: residents[3],
      title: "Visitor parking occupied by non-residents",
      description:
        "Two cars without society stickers have been parked in visitor parking for over a week. Guests have nowhere to park.",
      category: "PARKING",
      priority: "LOW",
      ageDays: 6,
      steps: [{ status: "IN_PROGRESS", note: "Security asked to log vehicle numbers at the gate.", afterDays: 3 }],
    },
    {
      resident: residents[0],
      title: "Garbage not collected from A-wing chute",
      description:
        "The A-wing chute collection point has not been cleared since Saturday. There is a smell on the lower floors.",
      category: "HOUSEKEEPING",
      priority: "MEDIUM",
      ageDays: 5,
      steps: [
        { status: "IN_PROGRESS", note: "Housekeeping supervisor informed.", afterDays: 1 },
        { status: "RESOLVED", note: "Chute cleared and daily collection schedule restored.", afterDays: 2 },
      ],
    },
    {
      resident: residents[1],
      title: "Main gate intercom not working",
      description:
        "The intercom from the main gate to B-1102 has not connected for the past few days. Security has to call on mobile every time.",
      category: "SECURITY",
      priority: "MEDIUM",
      ageDays: 4,
      steps: [{ status: "RESOLVED", note: "Intercom line re-terminated at the gate panel.", afterDays: 2 }],
    },
    {
      resident: residents[2],
      title: "Seepage on clubhouse ceiling",
      description:
        "There is a widening damp patch on the clubhouse ceiling near the entrance, with paint starting to flake off.",
      category: "COMMON_AREA",
      priority: "MEDIUM",
      ageDays: 2,
      steps: [],
    },
    {
      resident: residents[3],
      title: "Bathroom exhaust fan making loud noise",
      description:
        "The exhaust fan in the A-701 common bathroom rattles loudly whenever it is switched on. It started after last week's servicing.",
      category: "ELECTRICAL",
      priority: "LOW",
      ageDays: 1,
      steps: [],
    },
  ];

  for (const seed of seeds) {
    const createdAt = daysAgo(seed.ageDays);

    const complaint = await prisma.complaint.create({
      data: {
        residentId: seed.resident.id,
        title: seed.title,
        description: seed.description,
        category: seed.category,
        priority: seed.priority,
        createdAt,
        updatedAt: createdAt,
        events: {
          create: {
            type: "CREATED",
            toStatus: "OPEN",
            toPriority: "MEDIUM",
            note: "Complaint raised",
            actorId: seed.resident.id,
            actorName: seed.resident.name,
            actorRole: "RESIDENT",
            createdAt,
          },
        },
      },
    });

    if (seed.priority !== "MEDIUM") {
      await prisma.complaintEvent.create({
        data: {
          complaintId: complaint.id,
          type: "PRIORITY_CHANGED",
          fromPriority: "MEDIUM",
          toPriority: seed.priority,
          actorId: admin.id,
          actorName: admin.name,
          actorRole: "ADMIN",
          createdAt: new Date(createdAt.getTime() + 6 * 60 * 60 * 1000),
        },
      });
    }

    let currentStatus: "OPEN" | "IN_PROGRESS" | "RESOLVED" = "OPEN";
    let elapsed = 0;

    for (const step of seed.steps) {
      elapsed += step.afterDays;
      const at = new Date(createdAt.getTime() + elapsed * DAY_MS);

      await prisma.complaintEvent.create({
        data: {
          complaintId: complaint.id,
          type: "STATUS_CHANGED",
          fromStatus: currentStatus,
          toStatus: step.status,
          note: step.note,
          actorId: admin.id,
          actorName: admin.name,
          actorRole: "ADMIN",
          createdAt: at,
        },
      });

      await prisma.complaint.update({
        where: { id: complaint.id },
        data: {
          status: step.status,
          updatedAt: at,
          resolvedAt: step.status === "RESOLVED" ? at : null,
        },
      });

      currentStatus = step.status;
    }

    if (seed.flagOverdue && currentStatus !== "RESOLVED") {
      const at = new Date(createdAt.getTime() + (elapsed + 1) * DAY_MS);
      await prisma.complaint.update({
        where: { id: complaint.id },
        data: { overdueFlaggedAt: at },
      });
      await prisma.complaintEvent.create({
        data: {
          complaintId: complaint.id,
          type: "OVERDUE_FLAGGED",
          note: "No plumber assigned within the agreed window.",
          actorId: admin.id,
          actorName: admin.name,
          actorRole: "ADMIN",
          createdAt: at,
        },
      });
    }
  }

  await prisma.notice.createMany({
    data: [
      {
        title: "Water tank cleaning on Sunday, 9am to 2pm",
        body:
          "The overhead tanks for A and B wings will be cleaned this Sunday between 9am and 2pm. Water supply will be interrupted during these hours. Please store what you need the night before.",
        isImportant: true,
        authorId: admin.id,
        createdAt: daysAgo(1),
      },
      {
        title: "Diwali decoration committee - volunteers needed",
        body:
          "We are forming a small committee to plan the common-area decorations. If you would like to help, please leave your name at the society office by the end of this week.",
        isImportant: false,
        authorId: admin.id,
        createdAt: daysAgo(4),
      },
      {
        title: "Revised visitor parking rules",
        body:
          "Visitor parking is now limited to 12 hours per vehicle. Security will log entry times at the gate. Residents are requested to inform guests in advance.",
        isImportant: false,
        authorId: admin.id,
        createdAt: daysAgo(8),
      },
    ],
  });

  console.log(summary());
}

function summary() {
  return [
    "",
    "Seed complete.",
    "",
    `  Admin     ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`,
    `  Resident  priya@society.test / ${RESIDENT_PASSWORD}`,
    `  Resident  rahul@society.test / ${RESIDENT_PASSWORD}`,
    `  Resident  anita@society.test / ${RESIDENT_PASSWORD}`,
    `  Resident  vikram@society.test / ${RESIDENT_PASSWORD}`,
    "",
  ].join("\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
