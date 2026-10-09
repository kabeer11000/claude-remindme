"use client";

import { useSyncExternalStore } from "react";
import {
  PREFS_CHANGED_EVENT,
  getSoundEnabled,
  getWakeLockEnabled,
  setSoundEnabled,
  setWakeLockEnabled,
} from "@/lib/notificationPrefs";

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 transition hover:border-neutral-700">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-neutral-100">{label}</span>
        <span className="block text-sm text-neutral-500">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
          checked ? "bg-emerald-500" : "bg-neutral-700"
        }`}
      >
        <span
          className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </label>
  );
}

function subscribePrefs(onChange: () => void) {
  window.addEventListener(PREFS_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(PREFS_CHANGED_EVENT, onChange);
}

// These live inline on the dashboard instead of as a floating corner widget:
// they're settings you choose once, not something you need on every page, and
// an unlabeled icon pill gave no hint what it did.
export default function ScreenSettings() {
  const soundOn = useSyncExternalStore(subscribePrefs, getSoundEnabled, () => true);
  const wakeLockOn = useSyncExternalStore(subscribePrefs, getWakeLockEnabled, () => false);

  return (
    <div className="flex flex-col gap-2">
      <Toggle
        label="Play a sound"
        description="Chime when an alert pops up on this page."
        checked={soundOn}
        onChange={setSoundEnabled}
      />
      <Toggle
        label="Keep screen awake"
        description="Stop this display sleeping while the tab is open."
        checked={wakeLockOn}
        onChange={setWakeLockEnabled}
      />
    </div>
  );
}
