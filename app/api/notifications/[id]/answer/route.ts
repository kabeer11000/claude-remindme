import { auth } from "@/auth";
import { answerQuestion } from "@/lib/push";

export async function POST(request: Request, ctx: RouteContext<"/api/notifications/[id]/answer">) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { answer } = await request.json();
  if (typeof answer !== "string" || !answer.trim()) {
    return Response.json({ error: "Answer can't be empty." }, { status: 400 });
  }

  const row = await answerQuestion(session.user.id, Number(id), answer.trim());
  if (!row) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }
  return Response.json({ notification: row });
}
