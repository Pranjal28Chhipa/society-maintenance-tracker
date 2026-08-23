import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewComplaintForm } from "@/components/new-complaint-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getOverdueThresholdDays } from "@/lib/settings";
import { pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "Raise a complaint" };
export const dynamic = "force-dynamic";

export default async function NewComplaintPage() {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin/complaints");

  const thresholdDays = await getOverdueThresholdDays();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="New entry"
        title="Raise a complaint"
        description={`The office sees this straight away. If it is not resolved within ${pluralise(thresholdDays, "day")}, it is marked overdue and moves to the top of their queue.`}
      />
      <NewComplaintForm />
    </div>
  );
}
