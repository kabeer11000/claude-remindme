"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";

type Key = { id: string; label: string | null; createdAt: string; lastUsedAt: string | null };

export default function McpConnect({
  initialKeys,
  mcpUrl,
}: {
  initialKeys: Key[];
  mcpUrl: string;
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"cli" | "json">("cli");

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

  const keyPlaceholder = newKey ?? "YOUR_API_KEY";
  const cliCommand = `claude mcp add --transport http remindme ${mcpUrl} -H "Authorization: Bearer ${keyPlaceholder}" -s user`;
  const jsonConfig = JSON.stringify(
    {
      mcpServers: {
        remindme: {
          type: "http",
          url: mcpUrl,
          headers: { Authorization: `Bearer ${keyPlaceholder}` },
        },
      },
    },
    null,
    2
  );

  const hasKeys = keys.length > 0;
  const tabClass = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
      active ? "bg-neutral-100 text-neutral-950" : "text-neutral-400 hover:text-neutral-100"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          a. Get an API key
        </h3>
        <button
          onClick={createKey}
          disabled={busy}
          className={
            hasKeys
              ? "w-fit rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium transition hover:border-neutral-500 disabled:opacity-50"
              : "w-full rounded-xl bg-white px-5 py-3.5 text-base font-semibold text-neutral-950 shadow-lg shadow-white/5 transition hover:bg-neutral-200 disabled:opacity-50 sm:w-fit"
          }
        >
          {busy ? "Working..." : hasKeys ? "Generate another key" : "Generate API key"}
        </button>

        {newKey && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-medium text-emerald-300">
                Copy this now. It won&apos;t be shown again.
              </p>
              <CopyButton text={newKey} />
            </div>
            <code className="block break-all font-mono text-neutral-100">{newKey}</code>
            <p className="mt-2 text-xs text-emerald-200/70">
              It&apos;s already filled into the setup below.
            </p>
          </div>
        )}

        {hasKeys && (
          <ul className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="text-neutral-200">{k.label ?? "Key"}</span>
                  <span className="block text-xs text-neutral-500">
                    Created {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt
                      ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                      : " · never used"}
                  </span>
                </span>
                <button
                  onClick={() => revokeKey(k.id)}
                  disabled={busy}
                  className="shrink-0 rounded-md px-2 py-1 text-neutral-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          b. Add it to your AI client
        </h3>
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="mb-4 flex gap-1 rounded-lg bg-neutral-900 p-1" role="tablist">
            <button role="tab" aria-selected={tab === "cli"} onClick={() => setTab("cli")} className={tabClass(tab === "cli")}>
              Claude Code
            </button>
            <button role="tab" aria-selected={tab === "json"} onClick={() => setTab("json")} className={tabClass(tab === "json")}>
              Claude Desktop / other
            </button>
          </div>

          <p className="mb-2 text-sm text-neutral-400">
            {tab === "cli" ? (
              "Run once in a terminal. It registers the server for every future session."
            ) : (
              <>
                Paste into{" "}
                <code className="font-mono text-neutral-200">claude_desktop_config.json</code>, or any
                MCP client that accepts this format.
              </>
            )}
          </p>
          <div className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-black p-3">
            <pre className="flex-1 overflow-x-auto font-mono text-xs leading-relaxed text-neutral-200">
              {tab === "cli" ? cliCommand : jsonConfig}
            </pre>
            <CopyButton text={tab === "cli" ? cliCommand : jsonConfig} />
          </div>
          {!newKey && (
            <p className="mt-2 text-xs text-neutral-500">
              Replace <code className="font-mono text-neutral-300">YOUR_API_KEY</code> with your key,
              or generate a new one above to fill it in automatically.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
