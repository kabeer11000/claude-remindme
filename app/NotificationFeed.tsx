"use client";

import { useEffect, useRef, useState } from "react";
import { PREFS_CHANGED_EVENT, getSoundEnabled, getWakeLockEnabled } from "@/lib/notificationPrefs";

type Notification = { id: number; title: string; body: string; created_at: string };
type Banner = Notification & { exiting: boolean };

const POLL_MS = 4000;
const BANNER_MS = 6000;
const EXIT_MS = 250;
const HISTORY_LIMIT = 30;

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function playBeep(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.4);

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1175, ctx.currentTime + 0.12);
  osc2.connect(gain);
  osc2.start(ctx.currentTime + 0.12);
  osc2.stop(ctx.currentTime + 0.4);
}

export default function NotificationFeed() {
  const [history, setHistory] = useState<Notification[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const cursorRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Load notification history once on mount, for the notification-center panel.
  useEffect(() => {
    fetch("/api/notifications/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { notifications: Notification[] } | null) => {
        if (data) setHistory(data.notifications);
      })
      .catch(() => {});
  }, []);

  // Close the panel on an outside click or Escape.
  useEffect(() => {
    if (!panelOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPanelOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [panelOpen]);

  // Audio needs a user gesture before it's allowed to play -- grab the first
  // click/keypress anywhere on the page to unlock it ahead of time.
  useEffect(() => {
    function unlockAudio() {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    }
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // Screen Wake Lock: keep the display on while this tab is open, so the
  // live feed actually gets seen instead of notifying a sleeping screen.
  // The toggle lives on the dashboard (ScreenSettings); this just obeys the pref.
  //
  // Devices without the Wake Lock API (e.g. iOS <16, like an iPhone 7 Plus
  // maxed out at 15.8) fall back to the classic NoSleep.js trick: a muted,
  // looping, inline video. Browsers let muted inline video autoplay without a
  // gesture, and a page with an actively playing video is treated as "in use"
  // and not screen-dimmed, even though the Wake Lock API itself isn't there.
  useEffect(() => {
    async function sync() {
      const wantsLock = getWakeLockEnabled();
      const isVisible = document.visibilityState === "visible";
      const hasWakeLockApi = "wakeLock" in navigator;

      if (wantsLock && hasWakeLockApi && isVisible) {
        if (!wakeLockRef.current) {
          try {
            wakeLockRef.current = await navigator.wakeLock.request("screen");
            wakeLockRef.current.addEventListener("release", () => {
              wakeLockRef.current = null;
            });
          } catch {
            // Can fail on low battery or unsupported contexts -- nothing to do.
          }
        }
      } else if (!wantsLock && wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }

      if (!hasWakeLockApi && videoRef.current) {
        if (wantsLock && isVisible) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      }
    }

    sync();
    window.addEventListener(PREFS_CHANGED_EVENT, sync);
    document.addEventListener("visibilitychange", sync);
    const video = videoRef.current;
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, sync);
      document.removeEventListener("visibilitychange", sync);
      wakeLockRef.current?.release().catch(() => {});
      video?.pause();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (document.visibilityState !== "visible") {
        timer = setTimeout(poll, POLL_MS);
        return;
      }
      try {
        const url =
          cursorRef.current === null
            ? "/api/notifications"
            : `/api/notifications?after=${cursorRef.current}`;
        const res = await fetch(url);
        if (res.ok) {
          const data: { cursor: number; notifications: Notification[] } = await res.json();
          if (!cancelled) {
            const isFirstLoad = cursorRef.current === null;
            cursorRef.current = data.cursor;
            if (data.notifications.length > 0 && !isFirstLoad) {
              setHistory((prev) => [...data.notifications].reverse().concat(prev).slice(0, HISTORY_LIMIT));

              const fresh: Banner[] = data.notifications.map((n) => ({ ...n, exiting: false }));
              setBanners((prev) => [...prev, ...fresh]);
              fresh.forEach((n) => {
                setTimeout(() => {
                  setBanners((prev) =>
                    prev.map((b) => (b.id === n.id ? { ...b, exiting: true } : b))
                  );
                  setTimeout(() => {
                    setBanners((prev) => prev.filter((b) => b.id !== n.id));
                  }, EXIT_MS);
                }, BANNER_MS);
              });

              setPanelOpen((open) => {
                if (!open) setUnreadCount((count) => count + fresh.length);
                return open;
              });

              if (getSoundEnabled() && audioCtxRef.current) {
                playBeep(audioCtxRef.current);
              }
            }
          }
        }
      } catch {
        // Network hiccup -- just try again next tick.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  function togglePanel() {
    setPanelOpen((open) => {
      if (!open) setUnreadCount(0);
      return !open;
    });
  }

  return (
    <>
      <video
        ref={videoRef}
        src="/nosleep.mp4"
        muted
        loop
        playsInline
        aria-hidden
        className="fixed h-px w-px opacity-0"
      />

      {/* Phone-style status-bar bell: always visible, opens the notification
          center below it. This replaces a full-screen takeover dialog -- the
          goal is a glanceable signal plus a place to review history, not an
          interruption every time. */}
      <div className="fixed right-4 top-4 z-50">
        <button
          onClick={togglePanel}
          aria-label="Notifications"
          aria-expanded={panelOpen}
          className={`relative flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur transition ${
            panelOpen
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              : "border-neutral-800 bg-neutral-900/90 text-neutral-300 hover:border-neutral-600"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 12 6 8Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M9.5 16.5a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-semibold text-neutral-950">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {panelOpen && (
          <div
            ref={panelRef}
            className="animate-toast-in absolute right-0 top-14 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/95 shadow-2xl shadow-black/50 backdrop-blur"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <span className="text-sm font-medium text-neutral-200">Notifications</span>
              <span className="text-xs text-neutral-500">{history.length} recent</span>
            </div>
            <div className="overflow-y-auto">
              {history.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-neutral-500">
                  Nothing yet. Your AI&apos;s alerts will show up here.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-800">
                  {history.map((n) => (
                    <li key={n.id} className="flex gap-3 px-4 py-3">
                      <img src="/icon.svg" alt="" className="mt-0.5 h-6 w-6 shrink-0 rounded-md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-100">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-sm text-neutral-400">{n.body}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-neutral-600">{timeLabel(n.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Heads-up banners: a brief, dismissable popup under the bell for each
          new alert, phone-style, then it settles into history above. */}
      <div className="pointer-events-none fixed right-4 top-20 z-40 flex w-80 flex-col gap-2">
        {banners.map((banner) => (
          <div
            key={banner.id}
            className={`pointer-events-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/95 shadow-xl shadow-black/40 backdrop-blur ${
              banner.exiting ? "animate-toast-out" : "animate-toast-in"
            }`}
          >
            <button
              onClick={() => {
                setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, exiting: true } : b)));
                setTimeout(() => setBanners((prev) => prev.filter((b) => b.id !== banner.id)), EXIT_MS);
              }}
              className="flex w-full items-start gap-3 p-3 text-left"
            >
              <img src="/icon.svg" alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-100">{banner.title}</p>
                {banner.body && <p className="text-sm text-neutral-400">{banner.body}</p>}
              </div>
            </button>
            {!banner.exiting && (
              <div className="h-0.5 w-full bg-neutral-800">
                <div
                  className="h-full bg-emerald-400 animate-toast-progress"
                  style={{ animationDuration: `${BANNER_MS}ms` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
