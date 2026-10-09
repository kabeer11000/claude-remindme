import Link from "next/link";
import { auth } from "@/auth";

// Reads the session to switch the CTA; never static.
export const instant = false;

export default async function Home() {
  const session = await auth();

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <img src="/icon.svg" alt="" className="h-14 w-14 rounded-2xl shadow-lg shadow-emerald-500/10" />

        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">Claude RemindMe</h1>
          <p className="text-balance text-neutral-400">
            Register your devices, connect your AI over MCP, and get pinged the moment it finishes
            or needs you.
          </p>
        </div>

        <div className="flex gap-3">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-white px-6 py-2.5 font-medium text-neutral-950 transition hover:bg-neutral-200"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-full bg-white px-6 py-2.5 font-medium text-neutral-950 transition hover:bg-neutral-200"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-neutral-700 px-6 py-2.5 font-medium transition hover:border-neutral-500"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        <div className="mt-2 flex w-full items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-left backdrop-blur">
          <img src="/icon.svg" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-100">Claude RemindMe</p>
            <p className="truncate text-sm text-neutral-400">Your AI finished — ready for review.</p>
          </div>
        </div>

        <p className="text-xs text-neutral-600">
          Push via VAPID on desktop & Android, live in-page on everything else.
        </p>
      </div>
    </main>
  );
}
