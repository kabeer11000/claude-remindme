import Link from "next/link";
import { auth } from "@/auth";

// Reads the session to switch the CTA; never static.
export const instant = false;

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col">
      <section className="relative isolate overflow-hidden px-6 pt-28 pb-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(16,185,129,0.18),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
        />

        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
          <div className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/80 px-4 py-1.5 text-xs text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Built on the Model Context Protocol
          </div>

          <img src="/icon.svg" alt="" className="h-16 w-16 rounded-2xl shadow-lg shadow-emerald-500/10" />

          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Claude RemindMe
          </h1>
          <p className="max-w-lg text-balance text-lg text-neutral-400">
            Register your phone and computer once. Let Claude — or any MCP-compatible AI — ping
            you the moment it finishes, gets stuck, or needs a decision only you can make.
          </p>

          <div className="mt-2 flex gap-3">
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
                  Get started — it&apos;s free
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
        </div>

        {/* Mock notification toast */}
        <div className="mx-auto mt-16 flex max-w-sm items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 text-left shadow-2xl shadow-black/40 backdrop-blur">
          <img src="/icon.svg" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-100">Claude RemindMe</p>
            <p className="truncate text-sm text-neutral-400">
              Your AI finished the migration — ready for review.
            </p>
          </div>
          <span className="ml-auto shrink-0 text-xs text-neutral-600">now</span>
        </div>
      </section>

      <section className="border-t border-neutral-900 px-6 py-20">
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Register your devices",
              body: "Enable push on your laptop and phone's browser in one click. No app install.",
            },
            {
              step: "2",
              title: "Connect your AI via MCP",
              body: "Generate a key, paste one command or config block into Claude or your MCP client.",
            },
            {
              step: "3",
              title: "Get pinged, not polled",
              body: "Your AI calls send_notification when it's done, stuck, or needs your input.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6"
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-medium text-emerald-400">
                {item.step}
              </div>
              <h3 className="mb-1 font-medium text-neutral-100">{item.title}</h3>
              <p className="text-sm text-neutral-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-neutral-900 px-6 py-12 text-center">
        <p className="mx-auto max-w-md text-xs text-neutral-600">
          Notifications use the Web Push standard (VAPID). Works on desktop Chrome, Edge, and
          Firefox, plus Android Chrome. iOS requires 16.4+ with the site added to your Home Screen.
        </p>
      </section>
    </main>
  );
}
