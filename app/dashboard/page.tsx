import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { listSessions } from "@/lib/apiKeys";
import PushManager from "./PushManager";
import McpConnect from "./McpConnect";
import ScreenSettings from "./ScreenSettings";
import Sessions from "./Sessions";
import SignOutButton from "./SignOutButton";

// Always reads the session and queries per-user data; never static.
export const instant = false;

function Step({
  n,
  done,
  title,
  description,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8">
      <div className="mb-6 flex items-start gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            done ? "bg-emerald-500 text-neutral-950" : "bg-white text-neutral-950"
          }`}
          aria-label={done ? `Step ${n}, done` : `Step ${n}`}
        >
          {done ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            n
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-neutral-400">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const { rows: devices } = await sql`
    select id, endpoint, device_label, created_at from push_subscriptions
    where user_id = ${userId} order by created_at desc
  `;
  const { rows: keys } = await sql`
    select id, label, created_at, last_used_at from api_keys
    where user_id = ${userId} order by created_at desc
  `;
  const sessions = await listSessions(userId);

  const mcpUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/mcp`;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-neutral-900">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="" className="h-7 w-7 rounded-lg" />
            <span className="font-semibold">Claude RemindMe</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden truncate text-sm text-neutral-500 sm:inline">
              {session!.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        <div className="mb-2">
          <h1 className="text-3xl font-semibold tracking-tight">Set up in two steps</h1>
          <p className="mt-2 text-neutral-400">
            Turn on alerts for this device, then give your AI the key to reach you.
          </p>
        </div>

        <Step
          n={1}
          done={devices.length > 0}
          title="Turn on alerts for this device"
          description="Repeat on every device you want pinged: your laptop, your phone, anything with a browser."
        >
          <PushManager
            initialDevices={devices.map((d) => ({
              id: d.id,
              endpoint: d.endpoint,
              label: d.device_label,
            }))}
          />

          <div className="mt-8 border-t border-neutral-800 pt-6">
            <h3 className="text-sm font-medium text-neutral-200">While a RemindMe tab is open</h3>
            <p className="mb-3 mt-1 text-sm text-neutral-500">
              Alerts also pop up in the middle of this page. Saved per browser.
            </p>
            <ScreenSettings />
          </div>
        </Step>

        <Step
          n={2}
          done={keys.length > 0}
          title="Connect your AI"
          description={
            <>
              Generate a key and add the server to your client. Your AI can notify you, ask
              questions and wait for your reply, check messages you send it, and report what
              it&apos;s doing.
            </>
          }
        >
          <McpConnect
            mcpUrl={mcpUrl || "https://<your-deployment>.vercel.app/api/mcp"}
            initialKeys={keys.map((k) => ({
              id: k.id,
              label: k.label,
              createdAt: k.created_at,
              lastUsedAt: k.last_used_at,
            }))}
          />
        </Step>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Your AI sessions</h2>
          <p className="mt-1 mb-6 text-sm text-neutral-400">
            Every connected key is a session. Live ones pulse green and show what they&apos;re
            doing; idle ones show when they were last active.
          </p>
          <Sessions
            initialSessions={sessions.map((s) => ({
              id: s.id,
              label: s.label,
              created_at: s.created_at,
              last_used_at: s.last_used_at,
              status: s.status,
              status_at: s.status_at,
            }))}
          />
        </section>
      </main>
    </div>
  );
}
