/** Formatting helpers shared by Server and Client Components. */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Short reference shown in the register gutter.
 *
 * Derived from the real complaint id rather than a separate counter, so what a
 * resident reads out to the office is the same value the API and database use.
 */
export function entryRef(id: string): string {
  return id.slice(-6).toUpperCase();
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "today", "3 days ago", "2 months ago" - for the register's age column. */
export function timeAgo(value: string | Date): string {
  const then = new Date(value).getTime();
  const days = Math.floor((Date.now() - then) / DAY_MS);

  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
