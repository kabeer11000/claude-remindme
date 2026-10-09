import { sql } from "@/lib/db";

export async function sendMessage(userId: string, body: string) {
  const { rows } = await sql`
    insert into messages (user_id, body) values (${userId}, ${body})
    returning id, body, created_at
  `;
  return rows[0] as { id: number; body: string; created_at: string };
}

// Atomically "pops" every undelivered message: marking it delivered in the
// same statement that reads it means two concurrent check_messages calls
// can't both hand the same message back.
export async function popUndeliveredMessages(userId: string) {
  const { rows } = await sql`
    update messages set delivered_at = now()
    where user_id = ${userId} and delivered_at is null
    returning id, body, created_at
  `;
  return rows as { id: number; body: string; created_at: string }[];
}

export async function getRecentMessages(userId: string, limit = 30) {
  const { rows } = await sql`
    select id, body, created_at from messages
    where user_id = ${userId}
    order by id desc
    limit ${limit}
  `;
  return rows as { id: number; body: string; created_at: string }[];
}
