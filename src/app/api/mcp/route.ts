/**
 * MCP JSON-RPC endpoint.
 * POST /api/mcp — receives MCP requests from ChatGPT.
 * Authentication: Bearer token resolved to user_id server-side.
 * user_id is NEVER accepted from the request body.
 */
import { resolveUserFromAccessToken } from "@/lib/mcp/auth";
import { TOOLS, callTool } from "@/lib/mcp/tools";
import type { McpRequest, McpResponse } from "@/lib/mcp/types";
import { MCP_ERROR } from "@/lib/mcp/types";

const PROTOCOL_VERSION = "2025-03-26";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function jsonRpc(id: string | number | null, result: unknown): Response {
  const body: McpResponse = { jsonrpc: "2.0", id, result };
  return Response.json(body);
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string
): Response {
  const body: McpResponse = { jsonrpc: "2.0", id, error: { code, message } };
  return Response.json(body, { status: 200 }); // JSON-RPC errors are still 200
}

function unauthorized(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer realm="workout-tracker", as_uri="${APP_URL}/.well-known/oauth-authorization-server"`,
      },
    }
  );
}

export async function POST(request: Request): Promise<Response> {
  // Resolve user from Bearer token — never from request body
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return unauthorized();
  const rawToken = authHeader.slice(7);
  const userId = await resolveUserFromAccessToken(rawToken);
  if (!userId) return unauthorized();

  let body: McpRequest;
  try {
    body = (await request.json()) as McpRequest;
  } catch {
    return jsonRpcError(null, MCP_ERROR.PARSE_ERROR.code, MCP_ERROR.PARSE_ERROR.message);
  }

  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return jsonRpcError(body.id ?? null, MCP_ERROR.INVALID_REQUEST.code, MCP_ERROR.INVALID_REQUEST.message);
  }

  // Notifications (no id) — acknowledge and return
  if (body.id === undefined || body.id === null) {
    return new Response(null, { status: 202 });
  }

  const id = body.id;

  switch (body.method) {
    case "initialize": {
      return jsonRpc(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "workout-tracker", version: "1.0.0" },
      });
    }

    case "tools/list": {
      return jsonRpc(id, { tools: TOOLS });
    }

    case "tools/call": {
      const params = body.params as Record<string, unknown> | undefined;
      const toolName = String(params?.name ?? "");
      const toolArgs = params?.arguments;

      if (!toolName) {
        return jsonRpcError(id, MCP_ERROR.INVALID_PARAMS.code, "name is required");
      }
      if (!TOOLS.find((t) => t.name === toolName)) {
        return jsonRpcError(id, MCP_ERROR.METHOD_NOT_FOUND.code, `Tool "${toolName}" not found`);
      }

      try {
        const result = await callTool(toolName, toolArgs, userId);
        return jsonRpc(id, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[MCP] tool error:", msg);
        // JSON-RPC error はChatGPTが "Resource not found" と表示するため、
        // isError:true のツール結果として返すことでエラー内容を表示させる
        return jsonRpc(id, {
          content: [{ type: "text", text: `エラー: ${msg}` }],
          isError: true,
        });
      }
    }

    default:
      return jsonRpcError(id, MCP_ERROR.METHOD_NOT_FOUND.code, `Method "${body.method}" not found`);
  }
}

// Support OPTIONS for CORS preflight (ChatGPT may send preflight)
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}
