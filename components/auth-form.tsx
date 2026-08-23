"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button, Field, Input } from "./ui";

type Mode = "login" | "register";

/**
 * Sign-in and sign-up share one form: same fields, same error handling, two
 * extra inputs on register. Field-level errors come back from the API in
 * `details` and are rendered against the input they belong to.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setFieldErrors(data.details ?? {});
        setFormError(data.details ? null : (data.error ?? "Something went wrong"));
        return;
      }

      router.replace(data.user.role === "ADMIN" ? "/admin" : "/complaints");
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <div className="rise">
      <p className="eyebrow">{isRegister ? "New resident" : "Sign in"}</p>
      <h1 className="mt-2 text-[1.7rem] leading-tight font-bold tracking-tight text-ink">
        {isRegister ? "Register your flat" : "Open the register"}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {isRegister
          ? "Create an account to raise complaints and follow their progress."
          : "Sign in to raise a complaint or check where an existing one has got to."}
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        {formError ? <Alert>{formError}</Alert> : null}

        {isRegister ? (
          <>
            <Field label="Full name" htmlFor="name" error={fieldErrors.name} required>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Priya Nair"
                required
                aria-invalid={Boolean(fieldErrors.name)}
              />
            </Field>

            <Field
              label="Flat number"
              htmlFor="flatNumber"
              hint="Helps the office find you. You can add it later."
              error={fieldErrors.flatNumber}
            >
              <Input id="flatNumber" name="flatNumber" placeholder="A-204" />
            </Field>
          </>
        ) : null}

        <Field label="Email" htmlFor="email" error={fieldErrors.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={Boolean(fieldErrors.email)}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={isRegister ? "At least 8 characters." : undefined}
          error={fieldErrors.password}
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            aria-invalid={Boolean(fieldErrors.password)}
          />
        </Field>

        <Button type="submit" disabled={pending} className="w-full">
          {pending
            ? isRegister
              ? "Creating account…"
              : "Signing in…"
            : isRegister
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        {isRegister ? "Already registered? " : "New to the society? "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-semibold text-stamp-blue underline underline-offset-4 hover:text-ink"
        >
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
