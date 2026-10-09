"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { PREFS_CHANGED_EVENT, getSoundEnabled, getWakeLockEnabled } from "@/lib/notificationPrefs";

type Notification = { id: number; title: string; body: string; created_at: string };
type Toast = Notification & { exiting: boolean };

const POLL_MS = 4000;
const DISMISS_MS = 10000;
const EXIT_MS = 250;

function dismissToasts(setToasts: Dispatch<SetStateAction<Toast[]>>, ids: number[]) {
  const hit = (t: Toast) => ids.includes(t.id);
  setToasts((prev) => prev.map((t) => (hit(t) ? { ...t, exiting: true } : t)));
  setTimeout(() => setToasts((prev) => prev.filter((t) => !hit(t))), EXIT_MS);
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const cursorRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
              const fresh = data.notifications.map((n) => ({ ...n, exiting: false }));
              setToasts((prev) => [...prev, ...fresh]);
              const ids = fresh.map((n) => n.id);
              setTimeout(() => dismissToasts(setToasts, ids), DISMISS_MS);

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

  const visible = toasts.some((t) => !t.exiting);
  const dismissAll = () => dismissToasts(setToasts, toasts.map((t) => t.id));

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismissToasts(setToasts, toasts.map((t) => t.id));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, toasts]);

  // Hidden muted/looping video: the no-Wake-Lock-API fallback for keeping the
  // screen awake (see the effect above). Must stay mounted regardless of
  // whether a toast is showing, since the wake-lock toggle is independent.
  const wakeLockVideo = (
    <video
      ref={videoRef}
      src="/nosleep.mp4"
      muted
      loop
      playsInline
      aria-hidden
      className="fixed h-px w-px opacity-0"
    />
  );

  if (toasts.length === 0) return wakeLockVideo;

  // Centered on purpose: this feed exists for devices without OS push, so an
  // in-page alert is the *only* signal the user gets. A corner toast is easy
  // to miss on a glance at the screen; a dimmed, centered card is not.
  return (
    <>
      {wakeLockVideo}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={dismissAll}
        className={`absolute inset-0 bg-neutral-950/70 backdrop-blur-sm ${
          visible ? "animate-backdrop-in" : "opacity-0"
        }`}
      />
      <div className="relative flex w-full max-w-md flex-col gap-3" role="alert" aria-live="assertive">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`overflow-hidden rounded-2xl border border-emerald-500/40 bg-neutral-900 shadow-2xl shadow-emerald-500/10 ring-1 ring-black/40 ${
              toast.exiting ? "animate-toast-out" : "animate-toast-in"
            }`}
          >
            <div className="flex items-start gap-4 p-5">
              <img src="/icon.svg" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                  Claude RemindMe
                </p>
                <p className="mt-1 text-lg font-semibold leading-snug text-white">{toast.title}</p>
                {toast.body && <p className="mt-1 text-sm text-neutral-300">{toast.body}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-neutral-800 px-5 py-3">
              <span className="text-xs text-neutral-500">
                {new Date(toast.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
              <button
                onClick={() => dismissToasts(setToasts, [toast.id])}
                className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                Got it
              </button>
            </div>
            {!toast.exiting && (
              <div className="h-1 w-full bg-neutral-800">
                <div
                  className="h-full bg-emerald-400 animate-toast-progress"
                  style={{ animationDuration: `${DISMISS_MS}ms` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </>
  );
}
