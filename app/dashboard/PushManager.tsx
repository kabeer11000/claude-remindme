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
    (async () => {
      const ok =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      setSupported(ok);
      if (!ok) return;

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

      if (!("serviceWorker" in navigator)) return;
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

  if (supported === null) return <div className="h-12" />;

  const testLabel =
    testStatus === "sending"
      ? "Sending..."
      : testStatus === "sent"
        ? "Sent. Check your notifications"
        : testStatus === "error"
          ? "Failed, try again"
          : "Send a test";

  return (
    <div className="flex flex-col gap-5">
      {!supported ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-amber-300">No system push in this browser</p>
          <p className="mt-1 text-amber-200/80">
            You&apos;ll still get alerts on this page while it&apos;s open. For real push on
            iPhone, use iOS 16.4+, add this site to your Home Screen (Share, then Add to Home
            Screen), and open it from there.
          </p>
        </div>
      ) : subscribed ? (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2.5 text-sm font-medium text-emerald-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            This device is receiving push alerts
          </span>
          <button
            onClick={sendTestNotification}
            disabled={testStatus === "sending"}
            className={`w-fit rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
              testStatus === "error"
                ? "border-red-500/50 text-red-300"
                : "border-emerald-500/40 text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            {testLabel}
          </button>
        </div>
      ) : (
        <button
          onClick={enableNotifications}
          disabled={busy}
          className="w-full rounded-xl bg-white px-5 py-3.5 text-base font-semibold text-neutral-950 shadow-lg shadow-white/5 transition hover:bg-neutral-200 disabled:opacity-50 sm:w-fit"
        >
          {busy ? "Enabling..." : "Enable notifications on this device"}
        </button>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {devices.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Registered devices ({devices.length})
          </h3>
          <ul className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-neutral-200">{d.label ?? "Device"}</span>
                <button
                  onClick={() => removeDevice(d.endpoint)}
                  disabled={busy}
                  className="rounded-md px-2 py-1 text-neutral-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
