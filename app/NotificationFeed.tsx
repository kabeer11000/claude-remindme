"use client";

import { useEffect, useRef, useState } from "react";
import {
  PREFS_CHANGED_EVENT,
  getSoundEnabled,
  getWakeLockEnabled,
  setSoundEnabled,
  setWakeLockEnabled,
} from "@/lib/notificationPrefs";

type Notification = { id: number; title: string; body: string; created_at: string };
type Toast = Notification & { exiting: boolean };

const POLL_MS = 4000;
const DISMISS_MS = 7000;

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
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [wakeLockOn, setWakeLockOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const cursorRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Audio needs a user gesture before it's allowed to play — grab the first
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
  // live feed below actually gets seen instead of notifying a sleeping screen.
  useEffect(() => {
    setWakeLockSupported("wakeLock" in navigator);
    setWakeLockOn(getWakeLockEnabled());
    setSoundOn(getSoundEnabled());

    async function sync() {
      const wantsLock = getWakeLockEnabled();
      setWakeLockOn(wantsLock);
      setSoundOn(getSoundEnabled());

      if (wantsLock && "wakeLock" in navigator && document.visibilityState === "visible") {
        if (!wakeLockRef.current) {
          try {
            wakeLockRef.current = await navigator.wakeLock.request("screen");
            wakeLockRef.current.addEventListener("release", () => {
              wakeLockRef.current = null;
            });
          } catch {
            // Can fail on low battery or unsupported contexts — fine, button stays off.
          }
        }
      } else if (!wantsLock && wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    }

    sync();
    window.addEventListener(PREFS_CHANGED_EVENT, sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, sync);
      document.removeEventListener("visibilitychange", sync);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    function dismiss(id: number) {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }

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
              fresh.forEach((n) => setTimeout(() => dismiss(n.id), DISMISS_MS));

              if (getSoundEnabled() && audioCtxRef.current) {
                playBeep(audioCtxRef.current);
              }
            }
          }
        }
      } catch {
        // Network hiccup — just try again next tick.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  function toggleWakeLock() {
    setWakeLockEnabled(!wakeLockOn);
  }

  function toggleSound() {
    setSoundEnabled(!soundOn);
    setSoundOn(!soundOn);
  }

  return (
    <>
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto w-full max-w-sm cursor-pointer overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/95 shadow-2xl shadow-black/50 backdrop-blur ${
                toast.exiting ? "animate-toast-out" : "animate-toast-in"
              }`}
              onClick={() =>
                setToasts((prev) =>
                  prev.map((t) => (t.id === toast.id ? { ...t, exiting: true } : t))
                )
              }
            >
              <div className="flex items-start gap-3 p-4">
                <img src="/icon.svg" alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-100">{toast.title}</p>
                  <p className="text-sm text-neutral-400">{toast.body}</p>
                </div>
              </div>
              {!toast.exiting && (
                <div className="h-0.5 w-full bg-neutral-800">
                  <div
                    className="h-full bg-emerald-400 animate-toast-progress"
                    style={{ animationDuration: `${DISMISS_MS}ms` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-40 flex gap-2">
        {wakeLockSupported && (
          <button
            onClick={toggleWakeLock}
            title={wakeLockOn ? "Keeping this screen awake" : "Keep this screen awake"}
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-base backdrop-blur transition ${
              wakeLockOn
                ? "border-emerald-700 bg-emerald-950/60 text-emerald-400"
                : "border-neutral-800 bg-neutral-900/80 text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {wakeLockOn ? "☀️" : "🌙"}
          </button>
        )}
        <button
          onClick={toggleSound}
          title={soundOn ? "Notification sound on" : "Notification sound off"}
          className={`flex h-10 w-10 items-center justify-center rounded-full border text-base backdrop-blur transition ${
            soundOn
              ? "border-emerald-700 bg-emerald-950/60 text-emerald-400"
              : "border-neutral-800 bg-neutral-900/80 text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {soundOn ? "🔔" : "🔕"}
        </button>
      </div>
    </>
  );
}
