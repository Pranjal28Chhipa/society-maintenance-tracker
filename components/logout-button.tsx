"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="rounded-[3px] px-2.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-sheet hover:text-ink disabled:opacity-55"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
