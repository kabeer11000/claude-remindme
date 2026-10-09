import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { subscription, deviceLabel } = await request.json();
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const authKey = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !authKey) {
    return Response.json({ error: "Invalid subscription." }, { status: 400 });
  }

  await sql`
    insert into push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
    values (${session.user.id}, ${endpoint}, ${p256dh}, ${authKey}, ${deviceLabel ?? null})
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth
  `;

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const { endpoint } = await request.json();
  await sql`delete from push_subscriptions where endpoint = ${endpoint} and user_id = ${session.user.id}`;
  return Response.json({ ok: true });
}
