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

export async function getUserIdForApiKey(key: string) {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const { rows } = await sql`
    select user_id, id from api_keys where key_hash = ${hashApiKey(key)}
  `;
  const row = rows[0];
  if (!row) return null;
  await sql`update api_keys set last_used_at = now() where id = ${row.id}`;
  return row.user_id as string;
}
