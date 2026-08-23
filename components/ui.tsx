import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Shared primitives. Kept in one file so the visual language stays consistent. */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[3px] px-4 py-2.5 text-sm font-semibold " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-55";

const BUTTON_VARIANTS = {
  primary: "bg-ink text-manila hover:bg-stamp-blue",
  secondary: "bg-sheet text-ink ring-1 ring-rule hover:bg-sheet-sunk",
  danger: "bg-stamp-red text-white hover:bg-stamp-red/88",
  ghost: "text-ink-soft hover:bg-sheet-sunk hover:text-ink",
} as const;

type Variant = keyof typeof BUTTON_VARIANTS;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`} {...props} />
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`} {...props} />
  );
}

const CONTROL =
  "w-full rounded-[3px] border border-rule bg-sheet px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-ink-faint focus:border-stamp-blue focus:outline-none " +
  "focus:ring-2 focus:ring-stamp-blue/25 disabled:opacity-60";

/**
 * One labelled control. `error` renders inline and wires up `aria-describedby`
 * so the message is announced, not just coloured.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="eyebrow block">
        {label}
        {required ? <span className="ml-1 text-stamp-red">*</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-stamp-red">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${CONTROL} resize-y ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <select
      className={`${CONTROL} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8"><path fill="%235a6472" d="M1 1.5 6 6.5l5-5"/></svg>')] bg-[length:11px] bg-[right_0.85rem_center] bg-no-repeat pr-9 ${className}`}
      {...props}
    />
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "bg-stamp-red-soft text-stamp-red ring-stamp-red/25",
    success: "bg-stamp-green-soft text-stamp-green ring-stamp-green/25",
    info: "bg-stamp-blue-soft text-stamp-blue ring-stamp-blue/25",
  } as const;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[3px] px-3.5 py-2.5 text-sm font-medium ring-1 ${tones[tone]}`}
    >
      {children}
    </p>
  );
}

/** An empty list is an invitation to act, so it always carries the next step. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="sheet flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div
        aria-hidden
        className="flex h-11 w-9 items-center justify-center border border-dashed border-rule text-ink-faint"
      >
        <span className="font-mono text-[10px] tracking-widest">00</span>
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-ink-soft">{description}</p>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5">
      <div className="min-w-0">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

/** A ruled key/value row, as used on the register's summary column. */
export function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule-soft py-2 last:border-0">
      <span className="eyebrow shrink-0">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium text-ink">{children}</span>
    </div>
  );
}
