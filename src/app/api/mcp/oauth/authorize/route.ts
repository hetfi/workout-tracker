/**
 * OAuth 2.1 Authorization Endpoint
 * GET /api/mcp/oauth/authorize
 *
 * - Validates client_id and redirect_uri strictly (error shown inline, not redirected)
 * - PKCE (S256) required
 * - If user not authenticated → redirect to /login?next=...
 * - If authenticated → redirect to /mcp-consent?{validated_params}
 */
import { createClient } from "@/lib/supabase/server";
import { validateClient } from "@/lib/mcp/auth";

function errorPage(message: string): Response {
  return new Response(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;background:#0D0D0F;color:#fff">
<h2>認証エラー</h2><p>${message}</p></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const p = url.searchParams;

  const responseType = p.get("response_type");
  const clientId = p.get("client_id") ?? "";
  const redirectUri = p.get("redirect_uri") ?? "";
  const codeChallenge = p.get("code_challenge") ?? "";
  const codeChallengeMethod = p.get("code_challenge_method") ?? "";
  const state = p.get("state") ?? "";
  const scope = p.get("scope") ?? "read:workouts";

  // Strict validation before any redirect (prevents open redirect)
  if (responseType !== "code") {
    return errorPage("response_type must be 'code'");
  }
  if (!validateClient(clientId, redirectUri)) {
    return errorPage("クライアントIDまたはリダイレクトURIが無効です");
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return errorPage("PKCE (S256) が必要です");
  }

  // Check Supabase session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login; after login the user comes back to this authorize URL
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("next", request.url);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // Redirect to consent page with validated params
  const consentUrl = new URL("/mcp-consent", url.origin);
  consentUrl.searchParams.set("client_id", clientId);
  consentUrl.searchParams.set("redirect_uri", redirectUri);
  consentUrl.searchParams.set("code_challenge", codeChallenge);
  consentUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
  consentUrl.searchParams.set("state", state);
  consentUrl.searchParams.set("scope", scope);
  return Response.redirect(consentUrl.toString(), 302);
}
