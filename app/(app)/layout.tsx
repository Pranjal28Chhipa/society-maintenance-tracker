import { redirect } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { getCurrentUser } from "@/lib/auth";

/** Every page below this layout requires a session. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <SiteNav user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-rule px-4 py-5 sm:px-6">
        <p className="mx-auto max-w-6xl font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
          Society Maintenance Tracker · complaints, notices and history in one register
        </p>
      </footer>
    </>
  );
}
