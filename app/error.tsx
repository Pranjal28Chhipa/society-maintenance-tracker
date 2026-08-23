"use client";

import { useEffect } from "react";

/** Last-resort boundary. The detail goes to the console; the page stays calm. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="sheet max-w-md p-8 text-center">
        <p className="eyebrow text-stamp-red">Something broke</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">
          This page could not be loaded
        </h1>
        <p className="mt-2.5 text-sm text-ink-soft">
          Try again. If it keeps happening, the server log has the detail.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex rounded-[3px] bg-ink px-4 py-2.5 text-sm font-semibold text-manila transition-colors hover:bg-stamp-blue"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
