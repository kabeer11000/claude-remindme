import webpush from "web-push";
import { sql } from "@/lib/db";

webpush.setVapidDetails(
  "mailto:support@procheck.pk",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export type NotificationRow = {
  id: number;
  title: string;
  body: string;
  created_at: string;
  kind: "notification" | "question";
  options: string[] | null;
  answer: string | null;
  answered_at: string | null;
};

async function pushToDevices(userId: string, title: string, body: string) {
  const { rows } = await sql`
    select endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}
  `;

  const results = await Promise.allSettled(
    rows.map((row) =>
      webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify({ title, body })
      )
    )
  );

  // Prune subscriptions the push service says are gone (expired/unsubscribed).
  await Promise.all(
    results.map(async (result, i) => {
      if (result.status === "rejected" && [404, 410].includes(result.reason?.statusCode)) {
        await sql`delete from push_subscriptions where endpoint = ${rows[i].endpoint}`;
      }
    })
  );

  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    total: rows.length,
  };
}

// Records the notification (for the in-page live feed) and best-effort
// pushes it to every registered device. Works even with zero devices
// registered, since the in-page feed doesn't need push support at all.
export async function sendNotificationToUser(userId: string, title: string, body: string) {
  await sql`
    insert into notifications (user_id, title, body, kind) values (${userId}, ${title}, ${body}, 'notification')
  `;
  return pushToDevices(userId, title, body);
}

// Same idea, but as a question the user answers from the dashboard. Returns
// the notification id so the caller can poll for the reply.
export async function askUser(userId: string, question: string, options?: string[]) {
  const { rows } = await sql`
    insert into notifications (user_id, title, body, kind, options)
    values (${userId}, ${question}, '', 'question', ${options ? JSON.stringify(options) : null})
    returning id
  `;
  const id = Number(rows[0].id);
  await pushToDevices(userId, "Claude has a question", question);
  return id;
}

export async function getQuestion(userId: string, id: number) {
  const { rows } = await sql`
    select id, title, body, created_at, kind, options, answer, answered_at
    from notifications where id = ${id} and user_id = ${userId} and kind = 'question'
  `;
  return (rows[0] as NotificationRow) ?? null;
}

// Polls until the question is answered or the timeout elapses, returning the
// answer text or null on timeout. Meant to be awaited directly inside an MCP
// tool call so the AI's turn blocks on the user's reply, like a real prompt.
export async function waitForAnswer(userId: string, id: number, timeoutMs: number, intervalMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await getQuestion(userId, id);
    if (row?.answered_at) return row.answer;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

// Only the first answer sticks, in case two devices reply to the same
// question. Returns the row as it stands after the attempt either way.
export async function answerQuestion(userId: string, id: number, answer: string) {
  await sql`
    update notifications set answer = ${answer}, answered_at = now()
    where id = ${id} and user_id = ${userId} and kind = 'question' and answered_at is null
  `;
  return getQuestion(userId, id);
}

export async function getNotificationsSince(userId: string, afterId: number) {
  const { rows } = await sql`
    select id, title, body, created_at, kind, options, answer, answered_at from notifications
    where user_id = ${userId} and id > ${afterId}
    order by id asc
    limit 50
  `;
  return rows as NotificationRow[];
}

export async function getLatestNotificationId(userId: string) {
  const { rows } = await sql`
    select coalesce(max(id), 0) as id from notifications where user_id = ${userId}
  `;
  return Number(rows[0].id);
}

export async function getRecentNotifications(userId: string, limit = 30) {
  const { rows } = await sql`
    select id, title, body, created_at, kind, options, answer, answered_at from notifications
    where user_id = ${userId}
    order by id desc
    limit ${limit}
  `;
  return rows as NotificationRow[];
}
