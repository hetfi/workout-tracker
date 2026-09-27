"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAuthCode, validateClient } from "@/lib/mcp/auth";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function approveConsent(formData: FormData) {
  "use server";
  const clientId = formData.get("client_id") as string;
  const redirectUri = formData.get("redirect_uri") as string;
  const codeChallenge = formData.get("code_challenge") as string;
  const codeChallengeMethod = formData.get("code_challenge_method") as string;
  const state = formData.get("state") as string;
  const scope = formData.get("scope") as string;

  // Re-validate on submission (never trust client-side params blindly)
  if (!validateClient(clientId, redirectUri)) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rawCode = await createAuthCode({
    userId: user.id,
    clientId,
    redirectUri,
    scope: scope || "read:workouts",
    codeChallenge,
    codeChallengeMethod: codeChallengeMethod || "S256",
  });

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", rawCode);
  if (state) callbackUrl.searchParams.set("state", state);
  redirect(callbackUrl.toString());
}

async function denyConsent(formData: FormData) {
  "use server";
  const redirectUri = formData.get("redirect_uri") as string;
  const state = formData.get("state") as string;

  if (!redirectUri) redirect("/");

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("error", "access_denied");
  callbackUrl.searchParams.set("error_description", "User denied access");
  if (state) callbackUrl.searchParams.set("state", state);
  redirect(callbackUrl.toString());
}

export default async function McpConsentPage({ searchParams }: Props) {
  const params = await searchParams;
  const clientId = params.client_id ?? "";
  const redirectUri = params.redirect_uri ?? "";
  const codeChallenge = params.code_challenge ?? "";
  const codeChallengeMethod = params.code_challenge_method ?? "S256";
  const state = params.state ?? "";
  const scope = params.scope ?? "read:workouts";

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const currentUrl = `/mcp-consent?${new URLSearchParams(params as Record<string, string>).toString()}`;
    redirect(`/login?next=${encodeURIComponent(currentUrl)}`);
  }

  // Validate params (show error if invalid)
  if (!validateClient(clientId, redirectUri) || !codeChallenge) {
    return (
      <div style={{ background: "#0D0D0F", minHeight: "100vh", padding: "2rem", color: "#fff", fontFamily: "sans-serif" }}>
        <h2>無効なリクエスト</h2>
        <p style={{ color: "#8E8E93" }}>クライアントIDまたはリダイレクトURIが無効です。</p>
      </div>
    );
  }

  const hiddenFields = (
    <>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="code_challenge" value={codeChallenge} />
      <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />
      <input type="hidden" name="state" value={state} />
      <input type="hidden" name="scope" value={scope} />
    </>
  );

  return (
    <div
      style={{
        background: "#0D0D0F",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          background: "#1C1C1E",
          borderRadius: "1.25rem",
          padding: "2rem",
          maxWidth: "400px",
          width: "100%",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* App icon */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "#2C2C2E",
              borderRadius: "1rem",
              margin: "0 auto 0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
            }}
          >
            🏋️
          </div>
          <h1 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            アクセスの許可
          </h1>
        </div>

        {/* User info */}
        <p style={{ color: "#8E8E93", fontSize: "0.875rem", marginBottom: "1.25rem", textAlign: "center" }}>
          {user.email}
        </p>

        {/* Explanation */}
        <div
          style={{
            background: "#2C2C2E",
            borderRadius: "0.75rem",
            padding: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ color: "#fff", fontSize: "0.9rem", margin: "0 0 0.75rem", fontWeight: 600 }}>
            ChatGPT があなたの以下のデータへのアクセスを求めています:
          </p>
          <ul style={{ color: "#8E8E93", fontSize: "0.85rem", margin: 0, paddingLeft: "1.25rem", lineHeight: 1.8 }}>
            <li>トレーニングセッションの一覧・詳細（読み取りのみ）</li>
            <li>種目ごとの過去の記録（読み取りのみ）</li>
          </ul>
          <p style={{ color: "#48484A", fontSize: "0.75rem", margin: "0.75rem 0 0" }}>
            ※ データの書き込みや変更は行いません
          </p>
        </div>

        {/* Approve */}
        <form action={approveConsent} style={{ marginBottom: "0.75rem" }}>
          {hiddenFields}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.875rem",
              background: "#CAFF4D",
              color: "#0D0D0F",
              border: "none",
              borderRadius: "0.75rem",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            許可する
          </button>
        </form>

        {/* Deny */}
        <form action={denyConsent}>
          {hiddenFields}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.875rem",
              background: "transparent",
              color: "#8E8E93",
              border: "1px solid #3A3A3C",
              borderRadius: "0.75rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            拒否する
          </button>
        </form>
      </div>
    </div>
  );
}
