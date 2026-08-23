import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

/**
 * Role gate for the office section.
 *
 * The API enforces this independently on every admin endpoint - this only
 * keeps a resident from landing on a page that would fail to load anyway.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/complaints");

  return <>{children}</>;
}
