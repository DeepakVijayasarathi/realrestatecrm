"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Card, ErrorBanner, Field, Input } from "@/components/ui";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Landing here without a token (typed URL, mangled email link) previously showed the
  // normal form, then failed submission with an opaque "Validation failed" — say what's
  // actually wrong up front instead.
  if (!token) {
    return (
      <Card className="w-full max-w-md p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold">Invalid reset link</h1>
        <p className="text-sm text-slate-500">
          This page only works from the link in a password-reset email. Request a new one from the login page.
        </p>
        <Button className="mt-6 w-full" onClick={() => router.push("/login")}>Back to login</Button>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="w-full max-w-md p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold">Password updated</h1>
        <p className="text-sm text-slate-500">You can now log in with your new password.</p>
        <Button className="mt-6 w-full" onClick={() => router.push("/login")}>Go to login</Button>
      </Card>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords do not match");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/reset-password", { token, password });
      // Show explicit confirmation instead of silently landing on the login page —
      // the backend's success message was previously dropped on the floor.
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="mb-4 text-lg font-semibold">Set a new password</h1>
      <ErrorBanner message={error} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password">
          <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Reset password"}</Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-brand-700/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />
      </div>
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
