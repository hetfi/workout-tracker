/**
 * OAuth 2.1 Authorization Server Metadata (RFC 8414)
 * GET /.well-known/oauth-authorization-server
 * ChatGPT reads this to discover endpoints.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const issuer = `${url.protocol}//${url.host}`;

  const metadata = {
    issuer,
    authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["read:workouts"],
  };

  return Response.json(metadata, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
