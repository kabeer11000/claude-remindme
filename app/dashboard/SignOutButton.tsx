"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-full border border-neutral-800 px-3.5 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-white"
    >
      Sign out
    </button>
  );
}
