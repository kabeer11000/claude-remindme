import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { getApiKeyRecord, setKeyStatus } from "@/lib/apiKeys";
import { popUndeliveredMessages } from "@/lib/messages";
import { askUser, getQuestion, sendNotificationToUser, waitForAnswer } from "@/lib/push";

// Vercel caps serverless function duration by plan; this is set to the
// platform ceiling we can rely on so ask_user's wait actually gets to use it.
// If this account is on a plan with a higher ceiling, raise this to match.
export const maxDuration = 60;
const ASK_TIMEOUT_MS = 55_000;

function getServer(userId: string, keyId: string) {
  const server = new McpServer({ name: "claude-remindme", version: "1.0.0" });

  server.registerTool(
    "send_notification",
    {
      title: "Send notification",
      description:
        "Notify the user. Pushes to their registered phone/computer, and also appears instantly as a live toast on any open tab of their dashboard. Use this to let them know you finished a task, hit a blocker, or need their input.",
      inputSchema: {
        title: z.string().describe("Short notification title, e.g. 'Build finished'"),
        message: z.string().describe("Notification body text"),
      },
    },
    async ({ title, message }) => {
      const result = await sendNotificationToUser(userId, title, message);
      const pushNote =
        result.total === 0
          ? "No push devices registered, but it'll show up live if they have the dashboard open."
          : `Pushed to ${result.sent}/${result.total} registered device(s).`;
      return { content: [{ type: "text", text: pushNote }] };
    }
  );

  server.registerTool(
    "ask_user",
    {
      title: "Ask the user a question",
      description:
        "Ask the user something and wait for their reply from the dashboard or push notification. Give short `options` for one-tap answers (e.g. yes/no, pick one of these), or omit them for free text. Blocks for under a minute; if there's no reply yet, it returns the question's id so you can call check_answer with it later instead of asking again.",
      inputSchema: {
        question: z.string().describe("The question to ask, phrased for a quick reply"),
        options: z
          .array(z.string())
          .max(4)
          .optional()
          .describe("Up to 4 short choices for one-tap answers; omit for free text"),
      },
    },
    async ({ question, options }) => {
      const id = await askUser(userId, question, options);
      const answer = await waitForAnswer(userId, id, ASK_TIMEOUT_MS);
      if (answer === null) {
        return {
          content: [
            {
              type: "text",
              text: `No reply yet (question id ${id}). Keep working on something else and call check_answer with questionId ${id} later to pick up the reply, or ask again if it's urgent.`,
            },
          ],
        };
      }
      return { content: [{ type: "text", text: `User replied: ${answer}` }] };
    }
  );

  server.registerTool(
    "check_answer",
    {
      title: "Check a pending question",
      description: "Check whether the user has answered a question from an earlier ask_user call.",
      inputSchema: {
        questionId: z.number().describe("The id returned by ask_user"),
      },
    },
    async ({ questionId }) => {
      const row = await getQuestion(userId, questionId);
      if (!row) {
        return { content: [{ type: "text", text: "No question with that id." }] };
      }
      if (!row.answered_at) {
        return { content: [{ type: "text", text: "Still no reply yet." }] };
      }
      return { content: [{ type: "text", text: `User replied: ${row.answer}` }] };
    }
  );

  server.registerTool(
    "check_messages",
    {
      title: "Check for messages from the user",
      description:
        "Check whether the user has sent you anything new from their dashboard since you last checked -- new instructions, a question, 'stop', anything. Call this periodically during longer tasks, not just when you're stuck, so you notice if they chime in while away from the terminal.",
      inputSchema: {},
    },
    async () => {
      const messages = await popUndeliveredMessages(userId);
      if (messages.length === 0) {
        return { content: [{ type: "text", text: "No new messages." }] };
      }
      const text = messages
        .map((m) => `[${new Date(m.created_at).toLocaleTimeString()}] ${m.body}`)
        .join("\n");
      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "set_status",
    {
      title: "Report what you're doing",
      description:
        "Update the short status line the user sees on their dashboard for this session, e.g. 'Running the test suite', 'Reading the auth module', 'Waiting on a slow build'. Call it whenever what you're doing changes, so someone who isn't watching the terminal can tell you're alive and what you're up to.",
      inputSchema: {
        status: z.string().max(140).describe("Short, present-tense status"),
      },
    },
    async ({ status }) => {
      await setKeyStatus(keyId, status);
      return { content: [{ type: "text", text: "Status updated." }] };
    }
  );

  return server;
}

async function handle(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Missing API key" }, id: null },
      { status: 401 }
    );
  }

  const keyRecord = await getApiKeyRecord(apiKey);
  if (!keyRecord) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Invalid API key" }, id: null },
      { status: 401 }
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = getServer(keyRecord.userId, keyRecord.id);
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE };
