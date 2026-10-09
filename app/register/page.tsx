"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Account created, but sign-in failed. Try logging in.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
        <span className="font-semibold">Claude RemindMe</span>
      </Link>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8"
      >
        <h1 className="mb-1 text-2xl font-semibold">Create your account</h1>
        <p className="mb-6 text-sm text-neutral-400">Takes about ten seconds.</p>

        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-300">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
        />

        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-300">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
        />
        <p className="mb-4 text-xs text-neutral-600">At least 8 characters.</p>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-white px-4 py-2.5 font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="mt-4 text-center text-sm text-neutral-400">
          Already have an account?{" "}
          <Link href="/login" className="text-white underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
