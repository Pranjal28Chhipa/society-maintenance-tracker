import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

/**
 * The sign-in side of the app: the register's cover on the left, the form on
 * the right. Anyone already signed in is sent to their own section.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/complaints");

  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between border-r border-rule bg-ink px-10 py-12 text-manila lg:flex">
        <span aria-hidden className="absolute inset-y-0 left-16 w-px bg-stamp-red/50" />

        <Link href="/" className="relative flex items-center gap-3">
          <span className="flex h-9 w-8 items-center justify-center border-2 border-manila font-mono text-xs font-semibold">
            SM
          </span>
          <span className="text-sm font-bold tracking-tight">Society Maintenance Tracker</span>
        </Link>

        <div className="relative max-w-md">
          <p className="font-mono text-[11px] tracking-[0.16em] text-manila/55 uppercase">
            The complaint register, kept properly
          </p>
          <h2 className="mt-4 text-3xl leading-[1.15] font-bold tracking-tight text-balance">
            Every complaint gets an entry. Every entry gets a history.
          </h2>
          <p className="mt-4 font-serif text-[0.95rem] leading-relaxed text-manila/75">
            Residents raise an issue with a photo and watch it move. The office works a queue
            where whatever has waited longest sits at the top. Nothing is closed without a
            record of who closed it and when.
          </p>
        </div>

        <dl className="relative grid grid-cols-3 gap-6 border-t border-manila/20 pt-6">
          {[
            ["Raise", "with a photo"],
            ["Track", "every change"],
            ["Close", "with a record"],
          ].map(([term, detail]) => (
            <div key={term}>
              <dt className="text-sm font-semibold">{term}</dt>
              <dd className="mt-0.5 font-mono text-[10px] tracking-[0.12em] text-manila/50 uppercase">
                {detail}
              </dd>
            </div>
          ))}
        </dl>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
