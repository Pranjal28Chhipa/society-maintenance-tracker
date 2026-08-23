import { CATEGORY_LABELS, type ComplaintCategory } from "@/lib/domain";
import type { DashboardData } from "@/lib/dashboard";

/**
 * Dashboard marks.
 *
 * Deliberately small and server-rendered: no charting library, no client
 * JavaScript. Every value is also written out as text next to its bar, so the
 * numbers are readable without seeing colour at all - which is what makes the
 * colour a second encoding rather than the only one.
 */

/**
 * Complaints per category, split into still-open and resolved.
 *
 * One hue at two lightnesses, because this is one measure divided into a part
 * and a whole, not two separate identities.
 */
export function CategoryBars({ data }: { data: DashboardData["byCategory"] }) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-soft">No complaints recorded yet.</p>;
  }

  const rows = [...data].sort((a, b) => b.count - a.count);
  const max = Math.max(...rows.map((row) => row.count));

  return (
    <div>
      <Legend
        items={[
          { label: "Still open", color: "var(--color-chart-fill)" },
          { label: "Resolved", color: "var(--color-chart-fill-muted)" },
        ]}
      />

      <ul className="mt-4 space-y-2.5">
        {rows.map((row) => {
          const resolved = row.count - row.open;
          return (
            <li key={row.category} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3">
              <span className="truncate text-xs font-medium text-ink-soft">
                {CATEGORY_LABELS[row.category as ComplaintCategory]}
              </span>

              <span className="flex h-4 items-center gap-[2px]" aria-hidden>
                {row.open > 0 ? (
                  <span
                    className="h-full rounded-l-[1px] rounded-r-[4px] bg-chart-fill"
                    style={{ width: `${(row.open / max) * 100}%` }}
                    title={`${CATEGORY_LABELS[row.category as ComplaintCategory]}: ${row.open} still open`}
                  />
                ) : null}
                {resolved > 0 ? (
                  <span
                    className="h-full rounded-r-[4px] bg-chart-fill-muted"
                    style={{ width: `${(resolved / max) * 100}%` }}
                    title={`${CATEGORY_LABELS[row.category as ComplaintCategory]}: ${resolved} resolved`}
                  />
                ) : null}
              </span>

              <span className="text-right font-mono text-xs font-semibold text-ink">
                {row.count}
                <span className="sr-only">
                  {" "}
                  complaints, {row.open} still open, {resolved} resolved
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Parses a plain `YYYY-MM-DD` as a local date. `new Date(str)` would read it
 *  as UTC midnight, which renders as the previous day west of Greenwich. */
function localDay(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Complaints raised and resolved per day over the last fortnight. */
export function TrendStrip({ data }: { data: DashboardData["trend"] }) {
  const max = Math.max(1, ...data.map((day) => Math.max(day.raised, day.resolved)));

  return (
    <div>
      <Legend
        items={[
          { label: "Raised", color: "var(--color-chart-raised)" },
          { label: "Resolved", color: "var(--color-chart-resolved)" },
        ]}
      />

      <ul className="mt-4 flex h-28 items-end gap-[3px]">
        {data.map((day) => {
          const label = localDay(day.date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          });
          return (
            <li key={day.date} className="flex h-full flex-1 flex-col justify-end">
              <span className="flex h-full items-end justify-center gap-[2px]" aria-hidden>
                <span
                  className="w-1/2 max-w-2 rounded-t-[4px] bg-chart-raised"
                  style={{ height: `${Math.max(day.raised === 0 ? 0 : 6, (day.raised / max) * 100)}%` }}
                  title={`${label}: ${day.raised} raised`}
                />
                <span
                  className="w-1/2 max-w-2 rounded-t-[4px] bg-chart-resolved"
                  style={{
                    height: `${Math.max(day.resolved === 0 ? 0 : 6, (day.resolved / max) * 100)}%`,
                  }}
                  title={`${label}: ${day.resolved} resolved`}
                />
              </span>
              <span className="sr-only">
                {label}: {day.raised} raised, {day.resolved} resolved
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex justify-between border-t border-rule pt-2 font-mono text-[10px] tracking-wide text-ink-faint">
        <span>
          {localDay(data[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          <span className="font-mono text-[10px] tracking-[0.1em] text-ink-faint uppercase">
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
