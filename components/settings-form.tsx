"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button, Field, Input } from "./ui";

/**
 * The overdue threshold.
 *
 * Overdue is recomputed on every read, so saving a new value re-evaluates the
 * whole register immediately - there is no backfill and no waiting for a
 * nightly job. The copy says so, because it is surprising otherwise.
 */
export function SettingsForm({ initialDays }: { initialDays: number }) {
  const router = useRouter();
  const [days, setDays] = useState(String(initialDays));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overdueThresholdDays: Number(days) }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.details?.overdueThresholdDays ?? data.error ?? "Could not save the setting");
        return;
      }

      setDays(String(data.overdueThresholdDays));
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const changed = Number(days) !== initialDays;

  return (
    <form onSubmit={onSubmit} className="sheet space-y-4 p-5 sm:p-6" noValidate>
      {error ? <Alert>{error}</Alert> : null}
      {saved && !changed ? (
        <Alert tone="success">
          Saved. Every complaint in the register has been re-checked against the new threshold.
        </Alert>
      ) : null}

      <Field
        label="Overdue after"
        htmlFor="overdueThresholdDays"
        hint="Between 1 and 365 days. Counted from when the complaint was raised."
      >
        <div className="flex items-center gap-3">
          <Input
            id="overdueThresholdDays"
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="w-28"
          />
          <span className="text-sm text-ink-soft">days unresolved</span>
        </div>
      </Field>

      <Button type="submit" disabled={pending || !changed || days === ""}>
        {pending ? "Saving…" : "Save threshold"}
      </Button>
    </form>
  );
}
