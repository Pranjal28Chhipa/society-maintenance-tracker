"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button, Field, Input, Textarea } from "./ui";

/**
 * Post a notice to the board.
 *
 * Marking it important does two things at once - pins it to the top and emails
 * every resident - so the checkbox says so plainly rather than leaving the
 * mail as a surprise.
 */
export function NoticeComposer({ residentCount }: { residentCount: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [posted, setPosted] = useState<string | null>(null);
  const [isImportant, setIsImportant] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setPending(true);
    setError(null);
    setFieldErrors({});
    setPosted(null);

    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const response = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, isImportant }),
      });
      const result = await response.json();

      if (!response.ok) {
        setFieldErrors(result.details ?? {});
        setError(result.details ? null : (result.error ?? "Could not post the notice"));
        return;
      }

      form.reset();
      setPosted(
        isImportant
          ? `Posted and pinned. ${residentCount} resident${residentCount === 1 ? "" : "s"} emailed.`
          : "Posted to the board.",
      );
      setIsImportant(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sheet space-y-4 p-5 sm:p-6" noValidate>
      <div>
        <h2 className="text-base font-bold tracking-tight text-ink">Post a notice</h2>
        <p className="mt-1 text-sm text-ink-soft">Goes straight to the board for every resident.</p>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {posted ? <Alert tone="success">{posted}</Alert> : null}

      <Field label="Title" htmlFor="notice-title" error={fieldErrors.title} required>
        <Input
          id="notice-title"
          name="title"
          maxLength={140}
          placeholder="Water tank cleaning on Sunday, 9am to 2pm"
          required
        />
      </Field>

      <Field label="Notice" htmlFor="notice-body" error={fieldErrors.body} required>
        <Textarea
          id="notice-body"
          name="body"
          rows={5}
          maxLength={8000}
          placeholder="What is happening, when, and what residents need to do about it."
          required
          className="font-serif"
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-[3px] border border-rule bg-sheet-sunk p-3.5">
        <input
          type="checkbox"
          checked={isImportant}
          onChange={(event) => setIsImportant(event.target.checked)}
          className="mt-0.5 size-4 accent-[#a8342b]"
        />
        <span className="text-sm">
          <span className="block font-semibold text-ink">Mark as important</span>
          <span className="block text-ink-soft">
            Pins it to the top of the board and emails{" "}
            {residentCount === 1 ? "the 1 resident" : `all ${residentCount} residents`}.
          </span>
        </span>
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Posting…" : isImportant ? "Post and notify residents" : "Post notice"}
      </Button>
    </form>
  );
}
