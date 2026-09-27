/**
 * OAuth 2.1 Dynamic Client Registration (RFC 7591)
 * POST /api/mcp/oauth/register
 *
 * Allows ChatGPT to auto-register without a pre-configured client_id,
 * removing the need for users to manually enter the client ID during setup.
 */
export async function POST(): Promise<Response> {
  const clientId = `mcp-${crypto.randomUUID()}`;

  return Response.json(
    {
      client_id: clientId,
      client_secret_expires_at: 0,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      code_challenge_methods_supported: ["S256"],
    },
    {
      headers: { "Access-Control-Allow-Origin": "*" },
    }
  );
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
