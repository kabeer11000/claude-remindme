import { auth } from "@/auth";
import { getRecentNotifications } from "@/lib/push";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const notifications = await getRecentNotifications(session.user.id);
  return Response.json({ notifications });
}
