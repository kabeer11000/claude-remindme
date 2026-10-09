import { randomBytes, createHash } from "crypto";
import { sql } from "@/lib/db";

const KEY_PREFIX = "crm_";

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(userId: string, label: string) {
  const raw = KEY_PREFIX + randomBytes(24).toString("hex");
  await sql`
    insert into api_keys (user_id, key_hash, label)
    values (${userId}, ${hashApiKey(raw)}, ${label})
  `;
  return raw;
}

// Each API key is one "session" -- one connected MCP client. Looking it up
// also bumps last_used_at, which doubles as the session's heartbeat.
export async function getApiKeyRecord(key: string) {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const { rows } = await sql`
    select id, user_id from api_keys where key_hash = ${hashApiKey(key)}
  `;
  const row = rows[0];
  if (!row) return null;
  await sql`update api_keys set last_used_at = now() where id = ${row.id}`;
  return { id: row.id as string, userId: row.user_id as string };
}

export async function setKeyStatus(keyId: string, status: string) {
  await sql`update api_keys set status = ${status}, status_at = now() where id = ${keyId}`;
}

export async function listSessions(userId: string) {
  const { rows } = await sql`
    select id, label, created_at, last_used_at, status, status_at
    from api_keys where user_id = ${userId} order by created_at desc
  `;
  return rows as {
    id: string;
    label: string | null;
    created_at: string;
    last_used_at: string | null;
    status: string | null;
    status_at: string | null;
  }[];
}
