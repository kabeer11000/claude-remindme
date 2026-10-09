import { auth } from "@/auth";
import { sql } from "@/lib/db";
import PushManager from "./PushManager";
import ApiKeys from "./ApiKeys";
import SignOutButton from "./SignOutButton";

// Always reads the session and queries per-user data; never static.
export const instant = false;

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const { rows: devices } = await sql`
    select id, endpoint, device_label, created_at from push_subscriptions
    where user_id = ${userId} order by created_at desc
  `;
  const { rows: keys } = await sql`
    select id, label, created_at, last_used_at from api_keys
    where user_id = ${userId} order by created_at desc
  `;

  const mcpUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/mcp`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-neutral-400">{session!.user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="mb-1 text-lg font-medium">1. Register this device</h2>
        <p className="mb-4 text-sm text-neutral-400">
          Do this on every device you want notifications on — your Windows laptop, and your phone
          if its browser supports it.
        </p>
        <PushManager
          initialDevices={devices.map((d) => ({
            id: d.id,
            endpoint: d.endpoint,
            label: d.device_label,
          }))}
        />
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h2 className="mb-1 text-lg font-medium">2. Connect your AI via MCP</h2>
        <p className="mb-4 text-sm text-neutral-400">
          Generate a key, then add this server to Claude (or any MCP client) so it can call{" "}
          <code className="rounded bg-neutral-800 px-1">send_notification</code>.
        </p>
        <div className="mb-4 rounded-lg bg-neutral-950 p-3 text-xs text-neutral-300">
          <div>
            URL: <code>{mcpUrl || "https://<your-deployment>.vercel.app/api/mcp"}</code>
          </div>
          <div>Auth header: Authorization: Bearer &lt;your key&gt;</div>
        </div>
        <ApiKeys
          initialKeys={keys.map((k) => ({
            id: k.id,
            label: k.label,
            createdAt: k.created_at,
            lastUsedAt: k.last_used_at,
          }))}
        />
      </section>
    </main>
  );
}
