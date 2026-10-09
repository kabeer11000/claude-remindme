"use client";

import { useEffect, useState } from "react";

type Device = { id: string; endpoint: string; label: string | null };

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function syncSubscription(subscription: PushSubscription, deviceLabel: string) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription, deviceLabel }),
  });
  if (!res.ok) throw new Error("The server rejected this subscription.");
}

export default function PushManager({ initialDevices }: { initialDevices: Device[] }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [devices, setDevices] = useState(initialDevices);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const ready = await navigator.serviceWorker.ready;
        const existing = await (ready ?? registration).pushManager.getSubscription();
        if (existing) {
          setSubscribed(true);
          // Re-sync in case a previous save failed silently.
          const deviceLabel = /Mobi|Android/i.test(navigator.userAgent) ? "Phone" : "Computer";
          await syncSubscription(existing, deviceLabel).catch(() => {});
        }
      } catch {
        // Service worker registration can fail on some browsers (e.g. private
        // browsing); fall through and let the user try the explicit button.
      }
    })();
  }, []);

  async function enableNotifications() {
    setBusy(true);
    setError(null);
    try {
      if (Notification.permission === "denied") {
        setError(
          "Notifications are blocked for this site. Click the lock icon in your address bar to allow them, then try again."
        );
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission wasn't granted.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });
      }

      const deviceLabel = /Mobi|Android/i.test(navigator.userAgent) ? "Phone" : "Computer";
      await syncSubscription(subscription, deviceLabel);

      setSubscribed(true);
      setDevices((d) => [
        { id: subscription.endpoint, endpoint: subscription.endpoint, label: deviceLabel },
        ...d.filter((dev) => dev.endpoint !== subscription.endpoint),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong enabling notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTestNotification() {
    setTestStatus("sending");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      setTestStatus(res.ok ? "sent" : "error");
    } catch {
      setTestStatus("error");
    } finally {
      setTimeout(() => setTestStatus("idle"), 3000);
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
        You&apos;ll still get notifications live on this page while it&apos;s open — no setup
        needed.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {subscribed ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            This device is registered
          </span>
        ) : (
          <button
            onClick={enableNotifications}
            disabled={busy}
            className="w-fit rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
          >
            {busy ? "Enabling..." : "Enable notifications"}
          </button>
        )}

        {subscribed && (
          <button
            onClick={sendTestNotification}
            disabled={testStatus === "sending"}
            className="w-fit rounded-full border border-neutral-700 px-4 py-2 text-sm transition hover:border-neutral-500 disabled:opacity-50"
          >
            {testStatus === "sending"
              ? "Sending..."
              : testStatus === "sent"
                ? "Sent — check your notifications"
                : testStatus === "error"
                  ? "Failed, try again"
                  : "Send test notification"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
        <img src="/icon.svg" alt="" className="mt-0.5 h-8 w-8 rounded-md" />
        <div className="text-sm">
          <p className="font-medium text-neutral-200">Claude RemindMe</p>
          <p className="text-neutral-500">Your AI sent a notification.</p>
        </div>
        <span className="ml-auto shrink-0 text-xs text-neutral-600">preview</span>
      </div>

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
