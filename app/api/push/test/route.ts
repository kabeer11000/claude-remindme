import { auth } from "@/auth";
import { sendNotificationToUser } from "@/lib/push";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const result = await sendNotificationToUser(
    session.user.id,
    "Test notification",
    "If you can see this, Claude RemindMe can reach this device."
  );

  if (result.total === 0) {
    return Response.json({ error: "No devices registered yet." }, { status: 400 });
  }
  return Response.json(result);
}
