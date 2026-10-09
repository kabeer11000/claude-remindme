"use client";

import { useEffect, useState } from "react";

type Device = { id: string; endpoint: string; label: string | null };

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushManager({ initialDevices }: { initialDevices: Device[] }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [devices, setDevices] = useState(initialDevices);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, []);

  async function enableNotifications() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Notification permission was denied. Enable it in your browser's site settings.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      const deviceLabel = navigator.userAgent.includes("Mobile") ? "Phone" : "Computer";
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, deviceLabel }),
      });
      if (!res.ok) throw new Error("Failed to save subscription");

      setSubscribed(true);
      setDevices((d) => [
        { id: subscription.endpoint, endpoint: subscription.endpoint, label: deviceLabel },
        ...d.filter((dev) => dev.endpoint !== subscription.endpoint),
      ]);
      setMessage("This device is registered.");
    } catch {
      setMessage("Something went wrong enabling notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDevice(endpoint: string) {
    setBusy(true);
    try {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      setDevices((d) => d.filter((dev) => dev.endpoint !== endpoint));

      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      if (existing?.endpoint === endpoint) {
        await existing.unsubscribe();
        setSubscribed(false);
      }
    } finally {
      setBusy(false);
    }
  }

  if (supported === null) return null;

  if (!supported) {
    return (
      <p className="rounded-lg bg-neutral-950 p-3 text-sm text-amber-400">
        This browser doesn&apos;t support push notifications. On iPhone, this needs iOS 16.4+ with
        the site added to your Home Screen (Share → Add to Home Screen), then opened from there.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={enableNotifications}
        disabled={busy || subscribed}
        className="w-fit rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
      >
        {subscribed ? "This device is registered" : busy ? "Enabling..." : "Enable notifications"}
      </button>
      {message && <p className="text-sm text-neutral-400">{message}</p>}

      {devices.length > 0 && (
        <ul className="flex flex-col gap-2">
          {devices.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-lg bg-neutral-950 px-3 py-2 text-sm"
            >
              <span>{d.label ?? "Device"}</span>
              <button
                onClick={() => removeDevice(d.endpoint)}
                disabled={busy}
                className="text-neutral-500 hover:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
