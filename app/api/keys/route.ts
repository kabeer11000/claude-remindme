import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { createApiKey } from "@/lib/apiKeys";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const { rows } = await sql`
    select id, label, created_at, last_used_at from api_keys
    where user_id = ${session.user.id} order by created_at desc
  `;
  return Response.json({ keys: rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const { label } = await request.json().catch(() => ({ label: "MCP key" }));
  const key = await createApiKey(session.user.id, label || "MCP key");
  return Response.json({ key });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await request.json();
  await sql`delete from api_keys where id = ${id} and user_id = ${session.user.id}`;
  return Response.json({ ok: true });
}
