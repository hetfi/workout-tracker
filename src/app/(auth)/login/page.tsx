"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";

type Mode = "login" | "signup";

function DumbbellIcon() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Left outer plate */}
      <rect x="2" y="20" width="11" height="32" rx="5" fill="white" opacity="0.95" />
      {/* Left inner plate */}
      <rect x="12" y="26" width="7" height="20" rx="3" fill="white" opacity="0.6" />
      {/* Bar */}
      <rect x="18" y="32" width="36" height="8" rx="4" fill="white" opacity="0.9" />
      {/* Right inner plate */}
      <rect x="53" y="26" width="7" height="20" rx="3" fill="white" opacity="0.6" />
      {/* Right outer plate */}
      <rect x="59" y="20" width="11" height="32" rx="5" fill="white" opacity="0.95" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const supabase = createClient();

    if (mode === "signup") {
      const { error: authError } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (authError) {
        setError(authError.message);
      } else {
        setMessage("アカウントを作成しました。そのままログインできます。");
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInError) {
          router.push("/home");
          router.refresh();
        }
      }
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("メールアドレスまたはパスワードが違います");
        } else {
          setError(authError.message);
        }
      } else {
        router.push("/home");
        router.refresh();
      }
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ backgroundColor: "#0D0D0F" }}
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ backgroundColor: "#1C1C1E" }}
          >
            <DumbbellIcon />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              筋トレ記録
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#8E8E93" }}>
              {mode === "login" ? "アカウントにログイン" : "新しいアカウントを作成"}
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div
          className="flex rounded-2xl p-1"
          style={{ backgroundColor: "#1C1C1E" }}
        >
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); setMessage(""); }}
            className="flex-1 py-2 text-sm font-semibold rounded-xl transition-all"
            style={
              mode === "login"
                ? { backgroundColor: "#3A3A3C", color: "#FFFFFF" }
                : { backgroundColor: "transparent", color: "#8E8E93" }
            }
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
            className="flex-1 py-2 text-sm font-semibold rounded-xl transition-all"
            style={
              mode === "signup"
                ? { backgroundColor: "#3A3A3C", color: "#FFFFFF" }
                : { backgroundColor: "transparent", color: "#8E8E93" }
            }
          >
            新規登録
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
          />
          <Input
            label="パスワード（6文字以上）"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="••••••••"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {error && (
            <p className="text-sm" style={{ color: "#FF453A" }}>{error}</p>
          )}
          {message && (
            <p className="text-sm" style={{ color: "#30D158" }}>{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl text-base font-bold transition-opacity"
            style={{
              backgroundColor: "#CAFF4D",
              color: "#0D0D0F",
              opacity: loading ? 0.6 : 1,
              marginTop: "8px",
            }}
          >
            {loading
              ? "処理中..."
              : mode === "login"
              ? "ログイン"
              : "アカウントを作成"}
          </button>
        </form>

        <p className="text-center text-xs" style={{ color: "#48484A" }}>
          {mode === "login"
            ? "アカウントをお持ちでない方は「新規登録」へ"
            : "すでにアカウントをお持ちの方は「ログイン」へ"}
        </p>
      </div>
    </div>
  );
}
