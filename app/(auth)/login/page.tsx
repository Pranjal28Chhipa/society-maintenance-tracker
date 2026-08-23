import type { Metadata } from "next";

import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <AuthForm mode="login" />

      <div className="mt-8 border-t border-rule pt-5">
        <p className="eyebrow mb-2.5">Demo accounts</p>
        <dl className="space-y-1 font-mono text-[11px] tracking-wide text-ink-soft">
          <div className="flex justify-between gap-4">
            <dt>admin@society.test</dt>
            <dd className="text-ink-faint">Admin@123</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>priya@society.test</dt>
            <dd className="text-ink-faint">Resident@123</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
