import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="sheet max-w-md p-8 text-center">
        <p className="eyebrow">No such entry</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">
          That page is not in the register
        </h1>
        <p className="mt-2.5 text-sm text-ink-soft">
          The link may be old, or the complaint may belong to another resident.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-[3px] bg-ink px-4 py-2.5 text-sm font-semibold text-manila transition-colors hover:bg-stamp-blue"
        >
          Back to the register
        </Link>
      </div>
    </main>
  );
}
