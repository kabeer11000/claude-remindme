import { auth } from "@/auth";
import { getRecentNotifications } from "@/lib/push";
import { getRecentMessages } from "@/lib/messages";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const [notifications, messages] = await Promise.all([
    getRecentNotifications(session.user.id),
    getRecentMessages(session.user.id),
  ]);

  // Merge into one chat-style transcript, tagged by who sent it.
  const thread = [
    ...notifications.map((n) => ({ ...n, sender: "ai" as const })),
    ...messages.map((m) => ({
      id: m.id,
      title: "",
      body: m.body,
      created_at: m.created_at,
      kind: "message" as const,
      options: null,
      answer: null,
      answered_at: null,
      sender: "user" as const,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30);

  return Response.json({ notifications: thread });
}
