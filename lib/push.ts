import webpush from "web-push";
import { sql } from "@/lib/db";

webpush.setVapidDetails(
  "mailto:support@procheck.pk",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Records the notification (for the in-page live feed) and best-effort
// pushes it to every registered device. Works even with zero devices
// registered, since the in-page feed doesn't need push support at all.
export async function sendNotificationToUser(userId: string, title: string, body: string) {
  await sql`insert into notifications (user_id, title, body) values (${userId}, ${title}, ${body})`;

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

export async function getNotificationsSince(userId: string, afterId: number) {
  const { rows } = await sql`
    select id, title, body, created_at from notifications
    where user_id = ${userId} and id > ${afterId}
    order by id asc
    limit 50
  `;
  return rows as { id: number; title: string; body: string; created_at: string }[];
}

export async function getLatestNotificationId(userId: string) {
  const { rows } = await sql`
    select coalesce(max(id), 0) as id from notifications where user_id = ${userId}
  `;
  return Number(rows[0].id);
}

export async function getRecentNotifications(userId: string, limit = 30) {
  const { rows } = await sql`
    select id, title, body, created_at from notifications
    where user_id = ${userId}
    order by id desc
    limit ${limit}
  `;
  return rows as { id: number; title: string; body: string; created_at: string }[];
}
