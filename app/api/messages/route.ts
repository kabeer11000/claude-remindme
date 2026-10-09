import { auth } from "@/auth";
import { sendMessage } from "@/lib/messages";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { body } = await request.json();
  if (typeof body !== "string" || !body.trim()) {
    return Response.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const message = await sendMessage(session.user.id, body.trim());
  return Response.json({ message });
}
