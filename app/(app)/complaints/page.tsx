import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ComplaintEntry } from "@/components/complaint-entry";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listComplaints } from "@/lib/complaints";
import { COMPLAINT_STATUSES, STATUS_LABELS, type ComplaintStatus } from "@/lib/domain";
import { pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "My complaints" };
export const dynamic = "force-dynamic";

type Search = { status?: string };

const TABS = [
  { value: "", label: "All" },
  ...COMPLAINT_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

export default async function MyComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin/complaints");

  const { status } = await searchParams;
  const active = (COMPLAINT_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as ComplaintStatus)
    : null;

  // The unfiltered list doubles as the source for the tab counts, so the tabs
  // stay accurate without a second round of queries.
  const [filtered, all] = await Promise.all([
    listComplaints(user, {
      status: active,
      category: null,
      priority: null,
      from: null,
      to: null,
      overdueOnly: false,
      search: null,
      page: 1,
      pageSize: 100,
    }),
    listComplaints(user, {
      status: null,
      category: null,
      priority: null,
      from: null,
      to: null,
      overdueOnly: false,
      search: null,
      page: 1,
      pageSize: 100,
    }),
  ]);

  const countFor = (value: string) =>
    value === "" ? all.total : all.complaints.filter((c) => c.status === value).length;

  return (
    <>
      <PageHeader
        eyebrow="Resident register"
        title={`Your complaints`}
        description={`Everything you have raised, with the full history of each. A complaint is marked overdue if it stays unresolved for more than ${pluralise(all.overdueThresholdDays, "day")}.`}
        action={<ButtonLink href="/complaints/new">Raise a complaint</ButtonLink>}
      />

      <nav aria-label="Filter by status" className="mb-6 flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const isActive = (active ?? "") === tab.value;
          return (
            <Link
              key={tab.label}
              href={tab.value ? `/complaints?status=${tab.value}` : "/complaints"}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2 rounded-[3px] px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-ink text-manila"
                  : "bg-sheet text-ink-soft ring-1 ring-rule hover:text-ink"
              }`}
            >
              {tab.label}
              <span
                className={`font-mono text-[10px] ${isActive ? "text-manila/60" : "text-ink-faint"}`}
              >
                {countFor(tab.value)}
              </span>
            </Link>
          );
        })}
      </nav>

      {filtered.complaints.length === 0 ? (
        <EmptyState
          title={active ? `No ${STATUS_LABELS[active].toLowerCase()} complaints` : "Nothing raised yet"}
          description={
            active
              ? "Try another status, or raise a new complaint."
              : "When something in your flat or the building needs attention, raise it here and follow it through to resolved."
          }
          action={<ButtonLink href="/complaints/new">Raise a complaint</ButtonLink>}
        />
      ) : (
        <ul className="space-y-2.5">
          {filtered.complaints.map((complaint, index) => (
            <ComplaintEntry
              key={complaint.id}
              complaint={complaint}
              href={`/complaints/${complaint.id}`}
              index={index}
            />
          ))}
        </ul>
      )}
    </>
  );
}
