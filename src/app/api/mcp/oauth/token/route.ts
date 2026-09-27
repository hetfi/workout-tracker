/**
 * OAuth 2.1 Token Endpoint
 * POST /api/mcp/oauth/token
 *
 * Supports:
 *   grant_type=authorization_code  — exchange auth code for tokens (PKCE verified)
 *   grant_type=refresh_token       — rotate refresh token
 *
 * Returns JSON: { access_token, refresh_token, token_type, expires_in, scope }
 */
import { consumeAuthCode, issueTokens, refreshAccessToken, validateClient } from "@/lib/mcp/auth";

function tokenError(error: string, description: string, status = 400): Response {
  return Response.json({ error, error_description: description }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let params: URLSearchParams | Record<string, string>;

  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    params = new URLSearchParams(text);
  } else {
    try {
      params = (await request.json()) as Record<string, string>;
    } catch {
      return tokenError("invalid_request", "Could not parse request body");
    }
  }

  const get = (key: string) =>
    params instanceof URLSearchParams ? (params.get(key) ?? "") : (params[key] ?? "");

  const grantType = get("grant_type");
  const clientId = get("client_id");

  if (grantType === "authorization_code") {
    const code = get("code");
    const codeVerifier = get("code_verifier");
    const redirectUri = get("redirect_uri");

    if (!code || !codeVerifier || !redirectUri) {
      return tokenError("invalid_request", "code, code_verifier, redirect_uri are required");
    }
    // Validate redirect_uri matches registered client
    if (!validateClient(clientId, redirectUri)) {
      return tokenError("invalid_client", "Invalid client_id or redirect_uri", 401);
    }

    const result = await consumeAuthCode(code, codeVerifier, clientId, redirectUri);
    if (!result) {
      return tokenError("invalid_grant", "Authorization code is invalid, expired, or already used");
    }

    const tokens = await issueTokens({ userId: result.userId, clientId, scope: result.scope });
    return Response.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      scope: result.scope,
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = get("refresh_token");
    if (!refreshToken) {
      return tokenError("invalid_request", "refresh_token is required");
    }
    const tokens = await refreshAccessToken(refreshToken, clientId);
    if (!tokens) {
      return tokenError("invalid_grant", "Refresh token is invalid or expired");
    }
    return Response.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      scope: "read:workouts",
    });
  }

  return tokenError("unsupported_grant_type", `grant_type '${grantType}' is not supported`);
}
