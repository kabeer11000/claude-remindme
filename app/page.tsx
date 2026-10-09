import Link from "next/link";
import { auth } from "@/auth";

// Reads the session to switch the CTA; never static.
export const instant = false;

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-4">
        <img src="/icon.svg" alt="" className="h-14 w-14 rounded-2xl" />
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Claude RemindMe</h1>
        <p className="max-w-md text-balance text-neutral-400">
          Register your phone and computer once. Let Claude (or any MCP-compatible AI) ping you the
          moment it finishes, gets stuck, or needs a decision only you can make.
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
      <p className="max-w-md text-xs text-neutral-600">
        Notifications use the Web Push standard (VAPID). Works on desktop Chrome/Edge/Firefox and
        Android Chrome. iOS requires 16.4+ with the site added to your Home Screen.
      </p>
    </main>
  );
}
