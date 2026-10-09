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

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={createKey}
        disabled={busy}
        className="w-fit rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
      >
        {keys.length > 0 ? "Generate another key" : "Generate key"}
      </button>

      {newKey && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-emerald-400">Copy this now — it won&apos;t be shown again:</p>
            <CopyButton text={newKey} />
          </div>
          <code className="break-all text-neutral-200">{newKey}</code>
        </div>
      )}

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="mb-3 flex gap-1 rounded-lg bg-neutral-900 p-1 text-sm">
          <button
            onClick={() => setTab("cli")}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              tab === "cli" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Claude Code CLI
          </button>
          <button
            onClick={() => setTab("json")}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              tab === "json" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Claude Desktop / other clients
          </button>
        </div>

        {tab === "cli" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-neutral-400">
              Run this once in a terminal — it registers the server for every future session.
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-black/40 p-3">
              <code className="flex-1 overflow-x-auto whitespace-pre text-xs text-neutral-200">
                {cliCommand}
              </code>
              <CopyButton text={cliCommand} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-neutral-400">
              Paste into Claude Desktop&apos;s <code className="text-neutral-300">claude_desktop_config.json</code>,
              or any MCP-compatible client that accepts this format.
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-black/40 p-3">
              <pre className="flex-1 overflow-x-auto text-xs text-neutral-200">{jsonConfig}</pre>
              <CopyButton text={jsonConfig} />
            </div>
          </div>
        )}
      </div>

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
                  {k.lastUsedAt && ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
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
