"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
  type ComplaintStatus,
  type Priority,
} from "@/lib/domain";
import type { ComplaintDto } from "@/lib/serialize";

import { Alert, Button, Field, Select, Textarea } from "./ui";

/**
 * The office's controls for one complaint.
 *
 * Only transitions the API will accept are offered, so a resolved complaint
 * shows no status control at all rather than a button that returns 409.
 */
export function AdminComplaintActions({ complaint }: { complaint: ComplaintDto }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<ComplaintStatus | "">("");
  const [note, setNote] = useState("");

  const allowed = STATUS_TRANSITIONS[complaint.status];
  const isClosed = complaint.status === "RESOLVED";

  async function call(action: string, url: string, body: unknown) {
    setPending(action);
    setError(null);

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "That change could not be applied");
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      return false;
    } finally {
      setPending(null);
    }
  }

  async function updateStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nextStatus) return;

    const ok = await call("status", `/api/complaints/${complaint.id}/status`, {
      status: nextStatus,
      note: note.trim() || undefined,
    });

    if (ok) {
      setNextStatus("");
      setNote("");
    }
  }

  if (isClosed) {
    return (
      <div className="sheet p-5">
        <p className="eyebrow mb-2.5">Office actions</p>
        <p className="text-sm text-ink-soft">
          This complaint is resolved and closed. Its history is kept in full. If the problem comes
          back, the resident raises a new complaint.
        </p>
      </div>
    );
  }

  return (
    <div className="sheet space-y-5 p-5">
      <div>
        <p className="eyebrow mb-3">Office actions</p>
        {error ? <Alert>{error}</Alert> : null}
      </div>

      <form onSubmit={updateStatus} className="space-y-3">
        <Field label="Move to" htmlFor="status">
          <Select
            id="status"
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value as ComplaintStatus)}
          >
            <option value="">Keep as {STATUS_LABELS[complaint.status]}</option>
            {allowed.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Note for the resident"
          htmlFor="note"
          hint="Included in the email and kept in the history."
        >
          <Textarea
            id="note"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Plumber scheduled for Thursday morning."
            className="font-serif"
          />
        </Field>

        <Button type="submit" disabled={!nextStatus || pending !== null} className="w-full">
          {pending === "status" ? "Updating…" : "Update status"}
        </Button>
      </form>

      <div className="space-y-3 border-t border-rule pt-5">
        <Field label="Priority" htmlFor="priority">
          <Select
            id="priority"
            value={complaint.priority}
            disabled={pending !== null}
            onChange={(event) =>
              call("priority", `/api/complaints/${complaint.id}/priority`, {
                priority: event.target.value as Priority,
              })
            }
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </Field>

        <Button
          type="button"
          variant={complaint.overdueFlaggedAt ? "secondary" : "danger"}
          disabled={pending !== null}
          className="w-full"
          onClick={() =>
            call("overdue", `/api/complaints/${complaint.id}/overdue`, {
              flagged: !complaint.overdueFlaggedAt,
            })
          }
        >
          {pending === "overdue"
            ? "Saving…"
            : complaint.overdueFlaggedAt
              ? "Clear overdue flag"
              : "Flag as overdue"}
        </Button>

        <p className="text-xs leading-relaxed text-ink-faint">
          {complaint.overdue.isBreached
            ? `Already past the ${complaint.overdue.daysOverdue + 1}-day threshold automatically. Flagging pins it regardless of the threshold.`
            : "Flag a complaint that needs attention before it ages past the threshold."}
        </p>
      </div>
    </div>
  );
}
