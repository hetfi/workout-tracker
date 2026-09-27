/**
 * MCP OAuth 2.1 auth utilities.
 * Tokens are stored as SHA-256 hashes. Raw values are never logged or stored.
 */
import { createServiceRoleClient } from "@/lib/supabase/server";

// ---- Crypto helpers ----

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Verify PKCE S256: BASE64URL(SHA256(code_verifier)) === code_challenge */
export async function verifyPkceS256(
  codeVerifier: string,
  codeChallenge: string
): Promise<boolean> {
  const data = new TextEncoder().encode(codeVerifier);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const base64url = btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return base64url === codeChallenge;
}

// ---- Authorization codes ----

export async function createAuthCode(params: {
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}): Promise<string> {
  const rawCode = generateRawToken();
  const codeHash = await sha256hex(rawCode);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("mcp_oauth_authorization_codes").insert({
    code_hash: codeHash,
    user_id: params.userId,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scope,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
    expires_at: expiresAt,
  });
  if (error) throw new Error("Failed to create auth code");
  return rawCode;
}

export async function consumeAuthCode(
  rawCode: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string
): Promise<{ userId: string; scope: string } | null> {
  const codeHash = await sha256hex(rawCode);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("mcp_oauth_authorization_codes")
    .select("*")
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .single();

  if (error || !data) return null;

  const d = data as Record<string, unknown>;
  if (
    d.client_id !== clientId ||
    d.redirect_uri !== redirectUri ||
    new Date(d.expires_at as string) < new Date()
  ) {
    return null;
  }

  const pkceOk = await verifyPkceS256(codeVerifier, d.code_challenge as string);
  if (!pkceOk) return null;

  // Mark as used (one-time use)
  await supabase
    .from("mcp_oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", codeHash);

  return { userId: d.user_id as string, scope: d.scope as string };
}

// ---- Access tokens ----

export async function issueTokens(params: {
  userId: string;
  clientId: string;
  scope: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const rawAccess = generateRawToken();
  const rawRefresh = generateRawToken();
  const [accessHash, refreshHash] = await Promise.all([
    sha256hex(rawAccess),
    sha256hex(rawRefresh),
  ]);
  const expiresIn = 3600; // 1 hour
  const accessExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("mcp_oauth_tokens").insert({
    user_id: params.userId,
    client_id: params.clientId,
    access_token_hash: accessHash,
    refresh_token_hash: refreshHash,
    scope: params.scope,
    access_token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
  });
  if (error) throw new Error("Failed to issue tokens");

  return { accessToken: rawAccess, refreshToken: rawRefresh, expiresIn };
}

export async function refreshAccessToken(
  rawRefreshToken: string,
  clientId: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const refreshHash = await sha256hex(rawRefreshToken);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("mcp_oauth_tokens")
    .select("id, user_id, scope, refresh_token_expires_at")
    .eq("refresh_token_hash", refreshHash)
    .eq("client_id", clientId)
    .single();

  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  if (new Date(d.refresh_token_expires_at as string) < new Date()) return null;

  // Rotate: delete old token row and issue new ones
  await supabase.from("mcp_oauth_tokens").delete().eq("id", d.id as string);
  return issueTokens({ userId: d.user_id as string, clientId, scope: d.scope as string });
}

/**
 * Resolve user_id from a raw Bearer access token.
 * Returns null if token is invalid or expired.
 * user_id is NEVER taken from the request body — always resolved from the token.
 */
export async function resolveUserFromAccessToken(
  rawToken: string
): Promise<string | null> {
  const tokenHash = await sha256hex(rawToken);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("mcp_oauth_tokens")
    .select("id, user_id, access_token_expires_at")
    .eq("access_token_hash", tokenHash)
    .single();

  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  if (new Date(d.access_token_expires_at as string) < new Date()) return null;

  // Update last_used_at without blocking
  void supabase
    .from("mcp_oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", d.id as string);

  return d.user_id as string;
}

// ---- Client validation (from env vars, no hardcoded values) ----

export function validateClient(
  clientId: string,
  redirectUri: string
): boolean {
  const allowedClientId = process.env.MCP_OAUTH_CLIENT_ID;
  if (clientId !== allowedClientId) return false;

  // Accept any redirect URI from chatgpt.com connector OAuth path,
  // allowing multiple users to create their own plugin instances.
  if (redirectUri.startsWith("https://chatgpt.com/connector/oauth/")) return true;

  // Fallback: also accept explicitly listed URIs (comma-separated)
  const allowedUris = (process.env.MCP_OAUTH_REDIRECT_URIS ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  return allowedUris.includes(redirectUri);
}
