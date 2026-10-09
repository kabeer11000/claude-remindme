import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { getUserIdForApiKey } from "@/lib/apiKeys";
import { sendNotificationToUser } from "@/lib/push";

function getServer(userId: string) {
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

  const userId = await getUserIdForApiKey(apiKey);
  if (!userId) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Invalid API key" }, id: null },
      { status: 401 }
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = getServer(userId);
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE };
