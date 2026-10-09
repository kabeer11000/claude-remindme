import { auth } from "@/auth";
import { getLatestNotificationId, getNotificationsSince } from "@/lib/push";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const after = new URL(request.url).searchParams.get("after");

  if (after === null) {
    // First call: establish a cursor without replaying history.
    const cursor = await getLatestNotificationId(session.user.id);
    return Response.json({ cursor, notifications: [] });
  }

  const notifications = await getNotificationsSince(session.user.id, Number(after));
  const cursor = notifications.length ? notifications[notifications.length - 1].id : Number(after);
  return Response.json({ cursor, notifications });
}
