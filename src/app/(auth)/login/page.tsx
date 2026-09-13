"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Mode = "login" | "signup";

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
        // Auto sign in after signup
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / title */}
        <div className="text-center">
          <div className="text-5xl mb-4">🏋️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            筋トレ記録
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {mode === "login" ? "ログイン" : "新規アカウント登録"}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); setMessage(""); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "login"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400"
            }`}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "signup"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400"
            }`}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {message && (
            <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
          >
            {mode === "login" ? "ログイン" : "アカウントを作成"}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          {mode === "login"
            ? "アカウントをお持ちでない方は「新規登録」へ"
            : "すでにアカウントをお持ちの方は「ログイン」へ"}
        </p>
      </div>
    </div>
  );
}
