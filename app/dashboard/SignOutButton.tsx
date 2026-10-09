"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-full border border-neutral-700 px-4 py-1.5 text-sm transition hover:border-neutral-500"
    >
      Sign out
    </button>
  );
}
