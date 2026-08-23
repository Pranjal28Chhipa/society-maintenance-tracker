import { formatDate, timeAgo } from "@/lib/format";
import type { NoticeDto } from "@/lib/serialize";

/**
 * A notice as it appears on the board.
 *
 * Important notices are pinned and carry the thumbtack and a red top rule -
 * the same signal the physical board uses. Nothing else competes with it.
 */
export function NoticeCard({
  notice,
  index = 0,
  action,
}: {
  notice: NoticeDto;
  index?: number;
  action?: React.ReactNode;
}) {
  return (
    <article
      className={`sheet rise relative p-5 sm:p-6 ${
        notice.isImportant ? "border-t-[3px] border-t-stamp-red" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {notice.isImportant ? (
        <span
          aria-hidden
          className="absolute -top-[9px] left-6 flex size-4 items-center justify-center rounded-full bg-stamp-red ring-4 ring-manila"
        >
          <span className="size-1 rounded-full bg-white/85" />
        </span>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {notice.isImportant ? (
            <p className="eyebrow mb-1.5 text-stamp-red">Pinned · Important</p>
          ) : null}
          <h3 className="text-lg leading-snug font-bold tracking-tight text-balance text-ink">
            {notice.title}
          </h3>
        </div>
        {action}
      </div>

      <p className="prose-entry mt-3">{notice.body}</p>

      <p className="mt-4 border-t border-rule-soft pt-3 font-mono text-[11px] tracking-wide text-ink-faint">
        {notice.author?.name ?? "Society office"} · {formatDate(notice.createdAt)} ·{" "}
        {timeAgo(notice.createdAt)}
      </p>
    </article>
  );
}
