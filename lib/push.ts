import webpush from "web-push";
import { sql } from "@/lib/db";

webpush.setVapidDetails(
  "mailto:support@procheck.pk",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendNotificationToUser(userId: string, title: string, body: string) {
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
