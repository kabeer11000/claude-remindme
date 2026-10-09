"use client";

import { useEffect, useState } from "react";

type Session = {
  id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  status: string | null;
  status_at: string | null;
};

const ACTIVE_WINDOW_MS = 90_000;
const STATUS_FRESH_MS = 10 * 60_000;
const POLL_MS = 5000;
const FLAVOR_WORDS = [
  "Pondering",
  "Noodling",
  "Percolating",
  "Cogitating",
  "Synthesizing",
  "Reticulating",
  "Marinating",
  "Puzzling",
  "Wrangling",
  "Conjuring",
  "Simmering",
  "Tinkering",
  "Combobulating",
  "Vibing",
  "Mulling",
];

function useFlavorWord(active: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % FLAVOR_WORDS.length), 2200);
    return () => clearInterval(id);
  }, [active]);
  return FLAVOR_WORDS[index];
}

// Date.now() can't be called during render (impure), so "now" lives in state,
// refreshed on an interval -- this also means active/idle status re-evaluates
// on its own instead of only when a fresh poll result arrives.
function useNow(intervalMs: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function relativeTime(iso: string, now: number) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function SessionCard({ session }: { session: Session }) {
  const now = useNow(5000);
  const lastUsedMs = session.last_used_at ? new Date(session.last_used_at).getTime() : 0;
  const active = now !== null && now - lastUsedMs < ACTIVE_WINDOW_MS;
  const flavor = useFlavorWord(active);
  const statusIsFresh =
    now !== null &&
    !!session.status &&
    !!session.status_at &&
    now - new Date(session.status_at).getTime() < STATUS_FRESH_MS;

  const statusLine = active
    ? statusIsFresh
      ? session.status
      : `${flavor}…`
    : session.last_used_at && now !== null
      ? `Idle since ${relativeTime(session.last_used_at, now)}`
      : "Never connected";

  return (
    <li className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {active && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-400" : "bg-neutral-700"}`}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-100">{session.label ?? "Session"}</p>
        <p className={`truncate font-mono text-sm ${active ? "text-emerald-500/80" : "text-neutral-500"}`}>
          {statusLine}
          {active && <span className="animate-cursor-blink">▋</span>}
        </p>
      </div>
    </li>
  );
}

export default function Sessions({ initialSessions }: { initialSessions: Session[] }) {
  const [sessions, setSessions] = useState(initialSessions);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/sessions");
        if (res.ok && !cancelled) {
          const data: { sessions: Session[] } = await res.json();
          setSessions(data.sessions);
        }
      } catch {
        // Try again next tick.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }
    let timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Generate a key above and connect a client to see it show up here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
    </ul>
  );
}
