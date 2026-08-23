import { PRIORITY_LABELS, STATUS_LABELS, type ComplaintEventType } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import type { ComplaintEventDto } from "@/lib/serialize";

/**
 * The complaint's status history, oldest first.
 *
 * Every row is one immutable `ComplaintEvent`. Nothing here is reconstructed
 * from the complaint's current state, so the timeline stays accurate even
 * after the complaint is closed.
 */

const DOT: Record<ComplaintEventType, string> = {
  CREATED: "bg-ink",
  STATUS_CHANGED: "bg-stamp-blue",
  PRIORITY_CHANGED: "bg-stamp-amber",
  OVERDUE_FLAGGED: "bg-stamp-red",
  OVERDUE_CLEARED: "bg-stamp-green",
  NOTE_ADDED: "bg-ink-faint",
};

function describe(event: ComplaintEventDto): string {
  switch (event.type) {
    case "CREATED":
      return "Complaint raised";
    case "STATUS_CHANGED":
      return `${event.fromStatus ? STATUS_LABELS[event.fromStatus] : "—"} → ${
        event.toStatus ? STATUS_LABELS[event.toStatus] : "—"
      }`;
    case "PRIORITY_CHANGED":
      return `Priority ${event.fromPriority ? PRIORITY_LABELS[event.fromPriority] : "—"} → ${
        event.toPriority ? PRIORITY_LABELS[event.toPriority] : "—"
      }`;
    case "OVERDUE_FLAGGED":
      return "Flagged as overdue";
    case "OVERDUE_CLEARED":
      return "Overdue flag cleared";
    case "NOTE_ADDED":
      return "Note added";
  }
}

export function HistoryTimeline({ history }: { history: ComplaintEventDto[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-ink-soft">No history recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-0">
      <span aria-hidden className="absolute top-2 bottom-2 left-[5px] w-px bg-rule" />

      {history.map((event) => (
        <li key={event.id} className="relative flex gap-4 py-3 pl-6">
          <span
            aria-hidden
            className={`absolute top-[1.15rem] left-0 size-[11px] rounded-full ring-2 ring-sheet ${DOT[event.type]}`}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-semibold text-ink">{describe(event)}</p>
              <time
                dateTime={event.createdAt}
                className="font-mono text-[11px] tracking-wide text-ink-faint"
              >
                {formatDateTime(event.createdAt)}
              </time>
            </div>

            <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink-faint">
              {event.actor.name} · {event.actor.role === "ADMIN" ? "Admin" : "Resident"}
            </p>

            {event.note ? (
              <p className="mt-2 border-l-2 border-rule bg-sheet-sunk/70 px-3 py-2 font-serif text-sm leading-relaxed text-ink">
                {event.note}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
