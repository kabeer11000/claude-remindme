import Link from "next/link";
import { auth } from "@/auth";

// Reads the session to switch the CTA; never static.
export const instant = false;

const primary =
  "rounded-full bg-white px-7 py-3 font-semibold text-neutral-950 shadow-lg shadow-white/10 transition hover:bg-neutral-200";
const secondary =
  "rounded-full border border-neutral-700 px-7 py-3 font-medium text-neutral-200 transition hover:border-neutral-400 hover:text-white";

export default async function Home() {
  const session = await auth();

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <div className="flex w-full max-w-lg flex-col items-center gap-10 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Know when your AI
            <br />
            <span className="text-emerald-400">needs you.</span>
          </h1>
          <p className="max-w-md text-balance text-lg text-neutral-400">
            Connect Claude over MCP. Get a ping on your laptop or phone the moment it finishes or
            gets stuck.
          </p>
        </div>

        {/* What you actually get: mirrors the in-page alert card. */}
        <div className="w-full max-w-sm rounded-2xl border border-emerald-500/40 bg-neutral-900 p-4 text-left shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                Claude RemindMe
              </p>
              <p className="truncate font-semibold text-white">Refactor done. Ready for review.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          {session ? (
            <Link href="/dashboard" className={primary}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/register" className={primary}>
                Get started
              </Link>
              <Link href="/login" className={secondary}>
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
