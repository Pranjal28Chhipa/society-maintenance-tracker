import type { Metadata } from "next";

import { SettingsForm } from "@/components/settings-form";
import { DataRow, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { blobEnabled, mailEnabled } from "@/lib/env";
import { pluralise } from "@/lib/format";
import { getOverdueThresholdDays } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();

  const [thresholdDays, residents, complaints, notices] = await Promise.all([
    getOverdueThresholdDays(),
    prisma.user.count({ where: { role: "RESIDENT" } }),
    prisma.complaint.count(),
    prisma.notice.count(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Society settings"
        title="Settings"
        description="One number decides when the register starts calling a complaint overdue."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-4">
          <SettingsForm initialDays={thresholdDays} />

          <div className="sheet p-5 sm:p-6">
            <h2 className="text-base font-bold tracking-tight text-ink">
              How overdue is worked out
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
              <p>
                A complaint is overdue when it is still unresolved{" "}
                {pluralise(thresholdDays, "day")} after it was raised, or when you flag it by hand
                from the complaint page. Either way it moves to the top of the queue.
              </p>
              <p>
                Nothing is stored as &ldquo;overdue&rdquo;. It is worked out fresh every time the
                register is read, so changing this number re-checks every complaint at once -
                including old ones.
              </p>
              <p>Resolving a complaint closes it and clears any overdue flag on it.</p>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="sheet p-5">
            <p className="eyebrow mb-2.5">Register</p>
            <dl>
              <DataRow label="Residents">{residents}</DataRow>
              <DataRow label="Complaints">{complaints}</DataRow>
              <DataRow label="Notices">{notices}</DataRow>
            </dl>
          </div>

          <div className="sheet p-5">
            <p className="eyebrow mb-2.5">Integrations</p>
            <dl>
              <DataRow label="Email">
                {mailEnabled() ? (
                  <span className="text-stamp-green">Sending</span>
                ) : (
                  <span className="text-stamp-amber">Console only</span>
                )}
              </DataRow>
              <DataRow label="Photos">
                {blobEnabled() ? (
                  <span className="text-stamp-green">Vercel Blob</span>
                ) : (
                  <span className="text-stamp-amber">Local disk</span>
                )}
              </DataRow>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
              Set RESEND_API_KEY and BLOB_READ_WRITE_TOKEN to switch these on. Without them the app
              still works end to end - emails are written to the server log and photos are saved
              locally.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
