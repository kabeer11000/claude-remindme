"use client";

import { useState } from "react";

type Key = { id: string; label: string | null; createdAt: string; lastUsedAt: string | null };

export default function ApiKeys({ initialKeys }: { initialKeys: Key[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createKey() {
    setBusy(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "MCP key" }),
      });
      const data = await res.json();
      setNewKey(data.key);
      const listRes = await fetch("/api/keys");
      const listData = await listRes.json();
      setKeys(listData.keys);
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    setBusy(true);
    try {
      await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setKeys((k) => k.filter((key) => key.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={createKey}
        disabled={busy}
        className="w-fit rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
      >
        Generate new key
      </button>

      {newKey && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm">
          <p className="mb-1 text-emerald-400">Copy this now — it won&apos;t be shown again:</p>
          <code className="break-all text-neutral-200">{newKey}</code>
        </div>
      )}

      {keys.length > 0 && (
        <ul className="flex flex-col gap-2">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between rounded-lg bg-neutral-950 px-3 py-2 text-sm"
            >
              <span>
                {k.label ?? "Key"}{" "}
                <span className="text-neutral-600">
                  · created {new Date(k.createdAt).toLocaleDateString()}
                </span>
              </span>
              <button
                onClick={() => revokeKey(k.id)}
                disabled={busy}
                className="text-neutral-500 hover:text-red-400"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
