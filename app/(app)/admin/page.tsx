import type { Metadata } from "next";
import Link from "next/link";

import { PriorityTag } from "@/components/badges";
import { CategoryBars, TrendStrip } from "@/components/charts";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import { entryRef, pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * The office's one-screen answer to "what is on fire right now?"
 *
 * Overdue is the headline because it is the only figure that implies an
 * action. Everything else is context for it.
 */
export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const data = await getDashboard();
  const { totals } = data;

  const resolutionRate = totals.all > 0 ? Math.round((totals.resolved / totals.all) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow={`Signed in as ${admin.name}`}
        title="Maintenance at a glance"
        description={`Across ${pluralise(totals.all, "complaint")} in the register. Overdue means unresolved for more than ${pluralise(data.overdueThresholdDays, "day")}.`}
        action={<ButtonLink href="/admin/complaints">Open the queue</ButtonLink>}
      />

      {/* Overdue leads. The three lifecycle counts follow as context. */}
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/complaints?overdue=true"
          className={`sheet rise block p-5 transition-colors ${
            totals.overdue > 0
              ? "border-stamp-red bg-stamp-red-soft/45 hover:border-stamp-red"
              : "hover:border-ink-faint"
          }`}
        >
          <p className={`eyebrow ${totals.overdue > 0 ? "text-stamp-red" : ""}`}>Overdue</p>
          <p
            className={`mt-2 font-mono text-4xl leading-none font-semibold tabular-nums ${
              totals.overdue > 0 ? "text-stamp-red" : "text-ink"
            }`}
          >
            {totals.overdue}
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            {totals.overdue > 0
              ? "Waiting past the threshold. Pinned to the top of the queue."
              : "Nothing has aged past the threshold."}
          </p>
        </Link>

        <Stat
          label="Open"
          value={totals.open}
          href="/admin/complaints?status=OPEN"
          detail="Raised, not picked up yet."
          delay={40}
        />
        <Stat
          label="In progress"
          value={totals.inProgress}
          href="/admin/complaints?status=IN_PROGRESS"
          detail="Being worked on now."
          accent="text-stamp-blue"
          delay={80}
        />
        <Stat
          label="Resolved"
          value={totals.resolved}
          href="/admin/complaints?status=RESOLVED"
          detail={`${resolutionRate}% of everything ever raised.`}
          accent="text-stamp-green"
          delay={120}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="sheet p-5 sm:p-6">
          <h2 className="text-base font-bold tracking-tight text-ink">Where complaints come from</h2>
          <p className="mt-1 mb-4 text-sm text-ink-soft">
            Categories that keep coming back are the ones worth fixing at the source.
          </p>
          <CategoryBars data={data.byCategory} />
        </section>

        <section className="sheet p-5 sm:p-6">
          <h2 className="text-base font-bold tracking-tight text-ink">Last 14 days</h2>
          <p className="mt-1 mb-4 text-sm text-ink-soft">
            {data.averageResolutionDays === null
              ? "Nothing resolved yet, so there is no average to report."
              : `Complaints take ${pluralise(data.averageResolutionDays, "day")} to close on average.`}
          </p>
          <TrendStrip data={data.trend} />
        </section>

        <section className="sheet p-5 sm:p-6">
          <h2 className="text-base font-bold tracking-tight text-ink">Priority mix</h2>
          <p className="mt-1 mb-4 text-sm text-ink-soft">
            How the office has triaged the register so far.
          </p>
          <ul className="space-y-2.5">
            {data.byPriority.map((row) => (
              <li key={row.priority} className="flex items-center justify-between gap-4">
                <PriorityTag priority={row.priority} />
                <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="sheet p-5 sm:p-6">
          <h2 className="text-base font-bold tracking-tight text-ink">Waiting longest</h2>
          <p className="mt-1 mb-4 text-sm text-ink-soft">
            The complaints that have been overdue for the longest.
          </p>

          {data.oldestOverdue.length === 0 ? (
            <EmptyState
              title="Nothing is overdue"
              description="Every complaint in the register is inside the threshold."
            />
          ) : (
            <ul className="divide-y divide-rule-soft">
              {data.oldestOverdue.map((complaint) => (
                <li key={complaint.id}>
                  <Link
                    href={`/complaints/${complaint.id}`}
                    className="group flex items-center gap-3 py-2.5"
                  >
                    <span className="font-mono text-[10px] text-ink-faint">
                      {entryRef(complaint.id)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink group-hover:text-stamp-blue">
                        {complaint.title}
                      </span>
                      <span className="block font-mono text-[10px] tracking-wide text-ink-faint">
                        {complaint.residentName}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-stamp-red">
                      {complaint.daysOverdue}d
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  detail,
  href,
  accent = "text-ink",
  delay = 0,
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
  accent?: string;
  delay?: number;
}) {
  return (
    <Link
      href={href}
      className="sheet rise block p-5 transition-colors hover:border-ink-faint"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 font-mono text-4xl leading-none font-semibold tabular-nums ${accent}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-ink-soft">{detail}</p>
    </Link>
  );
}
