"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={onCopy}
      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${
        copied
          ? "bg-emerald-500 text-neutral-950"
          : "bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
      }`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
