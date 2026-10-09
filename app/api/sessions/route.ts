import { auth } from "@/auth";
import { listSessions } from "@/lib/apiKeys";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const sessions = await listSessions(session.user.id);
  return Response.json({ sessions });
}
