"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CATEGORIES, CATEGORY_LABELS } from "@/lib/domain";

import { Alert, Button, ButtonLink, Field, Input, Select, Textarea } from "./ui";

const MAX_PHOTO_MB = 5;
const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic";

/**
 * Raise a complaint.
 *
 * Posted as `multipart/form-data` so the photo travels with the complaint in a
 * single request - the row and its photo are created together or not at all.
 * The preview is a local object URL and is revoked when it is replaced.
 */
export function NewComplaintForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ url: string; name: string; size: number } | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFieldErrors((current) => ({ ...current, photo: "" }));

    if (preview) URL.revokeObjectURL(preview.url);

    if (!file) {
      setPreview(null);
      return;
    }

    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPreview(null);
      event.target.value = "";
      setFieldErrors((current) => ({
        ...current,
        photo: `Photo must be ${MAX_PHOTO_MB} MB or smaller. This one is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      }));
      return;
    }

    setPreview({ url: URL.createObjectURL(file), name: file.name, size: file.size });
  }

  function clearPhoto() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const data = await response.json();

      if (!response.ok) {
        setFieldErrors(data.details ?? {});
        setFormError(data.details ? null : (data.error ?? "Could not raise the complaint"));
        return;
      }

      router.push(`/complaints/${data.complaint.id}`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sheet space-y-5 p-5 sm:p-7" noValidate>
      {formError ? <Alert>{formError}</Alert> : null}

      <Field
        label="What is the problem?"
        htmlFor="title"
        hint="One line the office can scan at a glance."
        error={fieldErrors.title}
        required
      >
        <Input
          id="title"
          name="title"
          maxLength={140}
          placeholder="Kitchen tap leaking continuously"
          required
          aria-invalid={Boolean(fieldErrors.title)}
        />
      </Field>

      <Field label="Category" htmlFor="category" error={fieldErrors.category} required>
        <Select id="category" name="category" defaultValue="" required>
          <option value="" disabled>
            Choose a category
          </option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Describe it"
        htmlFor="description"
        hint="Where it is, when it started, and what you have already tried."
        error={fieldErrors.description}
        required
      >
        <Textarea
          id="description"
          name="description"
          rows={6}
          maxLength={4000}
          placeholder="The tap in the kitchen has been dripping since Monday and has turned into a steady stream overnight. The cabinet below is getting soaked."
          required
          aria-invalid={Boolean(fieldErrors.description)}
          className="font-serif"
        />
      </Field>

      <Field
        label="Photo"
        htmlFor="photo"
        hint={`Optional. JPEG, PNG, WebP or HEIC, up to ${MAX_PHOTO_MB} MB.`}
        error={fieldErrors.photo}
      >
        {preview ? (
          <div className="flex items-center gap-4 rounded-[3px] border border-rule bg-sheet-sunk p-3">
            {/* Local object URL, not a remote asset - next/image would add no value here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt="Preview of the photo attached to this complaint"
              className="size-20 shrink-0 rounded-[2px] border border-rule object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{preview.name}</p>
              <p className="font-mono text-[11px] text-ink-faint">
                {(preview.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={clearPhoto}>
              Remove
            </Button>
          </div>
        ) : null}

        <input
          ref={fileInput}
          id="photo"
          name="photo"
          type="file"
          accept={ACCEPTED}
          onChange={onPhotoChange}
          className={`w-full text-sm text-ink-soft file:mr-3 file:rounded-[3px] file:border file:border-rule file:bg-sheet-sunk file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-manila-deep/50 ${preview ? "sr-only" : ""}`}
        />
      </Field>

      <div className="flex flex-wrap gap-3 border-t border-rule pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Raising complaint…" : "Raise complaint"}
        </Button>
        <ButtonLink href="/complaints" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
