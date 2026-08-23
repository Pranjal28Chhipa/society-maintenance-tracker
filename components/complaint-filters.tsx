"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  CATEGORIES,
  CATEGORY_LABELS,
  COMPLAINT_STATUSES,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/domain";

import { Button, Field, Input, Select } from "./ui";

/**
 * Filter bar for the office queue.
 *
 * State lives in the URL, so a filtered queue can be bookmarked, shared, and
 * survives a refresh. The text search is debounced; every other control
 * applies immediately.
 */
export function ComplaintFilters({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("search") ?? "");

  const apply = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    const current = params.get("search") ?? "";
    if (search === current) return;

    const timer = setTimeout(() => apply("search", search), 350);
    return () => clearTimeout(timer);
    // `apply` is recreated on every render; the debounce only needs the text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const activeCount = ["status", "category", "priority", "from", "to", "overdue", "search"].filter(
    (key) => params.get(key),
  ).length;

  return (
    <section aria-label="Filter complaints" className="sheet mb-6 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Search" htmlFor="search">
          <Input
            id="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title or description"
          />
        </Field>

        <Field label="Status" htmlFor="filter-status">
          <Select
            id="filter-status"
            value={params.get("status") ?? ""}
            onChange={(event) => apply("status", event.target.value)}
          >
            <option value="">Any status</option>
            {COMPLAINT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Category" htmlFor="filter-category">
          <Select
            id="filter-category"
            value={params.get("category") ?? ""}
            onChange={(event) => apply("category", event.target.value)}
          >
            <option value="">Any category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Priority" htmlFor="filter-priority">
          <Select
            id="filter-priority"
            value={params.get("priority") ?? ""}
            onChange={(event) => apply("priority", event.target.value)}
          >
            <option value="">Any priority</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Raised from" htmlFor="filter-from">
          <Input
            id="filter-from"
            type="date"
            value={params.get("from") ?? ""}
            onChange={(event) => apply("from", event.target.value)}
          />
        </Field>

        <Field label="Raised until" htmlFor="filter-to">
          <Input
            id="filter-to"
            type="date"
            value={params.get("to") ?? ""}
            onChange={(event) => apply("to", event.target.value)}
          />
        </Field>

        <div className="flex items-end sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-[3px] border border-rule bg-sheet-sunk px-3 py-2.5 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={params.get("overdue") === "true"}
              onChange={(event) => apply("overdue", event.target.checked ? "true" : "")}
              className="size-4 accent-[#a8342b]"
            />
            Overdue only
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3.5">
        <p className="font-mono text-[11px] tracking-wide text-ink-faint">
          {pending ? "Filtering…" : `${resultCount} matching`}
          {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? "" : "s"} on` : ""}
        </p>
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => {
              setSearch("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </section>
  );
}
