"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "./ui";

/**
 * Per-notice controls.
 *
 * Deleting takes two clicks in place rather than a native confirm dialog, so
 * the confirmation stays inside the page and can be dismissed by clicking away
 * from it.
 */
export function NoticeActions({
  noticeId,
  isImportant,
}: {
  noticeId: string;
  isImportant: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function togglePin() {
    setPending("pin");
    await fetch(`/api/notices/${noticeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isImportant: !isImportant }),
    });
    setPending(null);
    router.refresh();
  }

  async function remove() {
    setPending("delete");
    await fetch(`/api/notices/${noticeId}`, { method: "DELETE" });
    setPending(null);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="danger"
          className="px-2.5 py-1.5 text-xs"
          onClick={remove}
          disabled={pending !== null}
        >
          {pending === "delete" ? "Deleting…" : "Delete for good"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="px-2 py-1.5 text-xs"
          onClick={() => setConfirming(false)}
        >
          Keep
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        type="button"
        variant="secondary"
        className="px-2.5 py-1.5 text-xs"
        onClick={togglePin}
        disabled={pending !== null}
      >
        {pending === "pin" ? "Saving…" : isImportant ? "Unpin" : "Pin and notify"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="px-2 py-1.5 text-xs"
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    </div>
  );
}
