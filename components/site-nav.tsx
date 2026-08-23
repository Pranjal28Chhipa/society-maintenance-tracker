import Link from "next/link";

import type { SessionUser } from "@/lib/auth";

import { LogoutButton } from "./logout-button";

/**
 * The register's cover: society mark on the left, the sections of the book in
 * the middle, and who is signing entries on the right.
 */
export function SiteNav({ user }: { user: SessionUser }) {
  const links =
    user.role === "ADMIN"
      ? [
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/complaints", label: "Complaints" },
          { href: "/admin/notices", label: "Notices" },
          { href: "/admin/settings", label: "Settings" },
        ]
      : [
          { href: "/complaints", label: "My complaints" },
          { href: "/notices", label: "Notice board" },
        ];

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-manila/92 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link
          href={user.role === "ADMIN" ? "/admin" : "/complaints"}
          className="flex items-center gap-2.5"
        >
          <span
            aria-hidden
            className="flex h-7 w-6 shrink-0 items-center justify-center border-2 border-ink font-mono text-[10px] font-semibold text-ink"
          >
            SM
          </span>
          <span className="text-sm leading-tight font-bold tracking-tight">
            Society Maintenance
            <span className="block font-mono text-[10px] font-medium tracking-[0.16em] text-ink-faint uppercase">
              {user.role === "ADMIN" ? "Office register" : "Resident register"}
            </span>
          </span>
        </Link>

        <nav aria-label="Sections" className="order-3 -mx-1 flex flex-1 gap-1 sm:order-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[3px] px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-sheet hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="order-2 ml-auto flex items-center gap-3 sm:order-3">
          <span className="hidden text-right text-xs leading-tight sm:block">
            <span className="block font-semibold text-ink">{user.name}</span>
            <span className="block font-mono text-[10px] tracking-wider text-ink-faint uppercase">
              {user.role === "ADMIN" ? "Admin" : (user.flatNumber ?? "Resident")}
            </span>
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
