"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserSettings, updateUserSettings } from "@/repositories/userSettings";
import { getIntervalEnabled, setIntervalEnabled } from "@/lib/storage/localSettings";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import type { UserSettings } from "@/domain/types";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "#FFFFFF" }}>
          {label}
        </p>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: "#8E8E93" }}>
            {description}
          </p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-12 h-7 rounded-full transition-colors shrink-0"
        style={{ backgroundColor: checked ? "#CAFF4D" : "#3A3A3C", transition: "background-color 0.15s" }}
      >
        <span
          className="absolute top-1 w-5 h-5 rounded-full shadow"
          style={{
            backgroundColor: checked ? "#0D0D0F" : "#8E8E93",
            left: checked ? "24px" : "4px",
            transition: "left 0.15s ease-in-out, background-color 0.15s",
          }}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [settings, setSettings] = useState<Partial<UserSettings>>({
    soundEnabled: true,
    vibrationEnabled: true,
    browserNotificationEnabled: false,
  });
  const [intervalEnabled, setIntervalEnabledState] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getUserSettings().then((s) => {
      if (s) setSettings(s);
    });
    setIntervalEnabledState(getIntervalEnabled());
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserSettings({
        soundEnabled: settings.soundEnabled,
        vibrationEnabled: settings.vibrationEnabled,
        browserNotificationEnabled: settings.browserNotificationEnabled,
      });
      showToast("設定を保存しました", "success");
    } catch {
      showToast("保存に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEnableNotification = async () => {
    if (!("Notification" in window)) {
      showToast("このブラウザは通知をサポートしていません", "warning");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setSettings((prev) => ({ ...prev, browserNotificationEnabled: true }));
      showToast("通知が許可されました", "success");
    } else {
      showToast("通知が拒否されました", "error");
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="py-6 space-y-5">
      <h1 className="text-xl font-bold" style={{ color: "#FFFFFF" }}>
        設定
      </h1>

      {/* Interval timer settings */}
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>
          インターバルタイマー
        </h2>
        <div
          className="space-y-3 divide-y"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <ToggleRow
            label="インターバルタイマーを使用する"
            description="セット完了後に自動でインターバルカウントダウンを開始する"
            checked={intervalEnabled}
            onChange={(v) => {
              setIntervalEnabledState(v);
              setIntervalEnabled(v);
            }}
          />
          <div className="pt-3">
            <ToggleRow
              label="通知音"
              description="インターバル終了時に音を鳴らす"
              checked={settings.soundEnabled ?? true}
              onChange={(v) =>
                setSettings((prev) => ({ ...prev, soundEnabled: v }))
              }
            />
          </div>
          <div className="pt-3">
            <ToggleRow
              label="バイブレーション"
              description="対応端末でバイブレーションする"
              checked={settings.vibrationEnabled ?? true}
              onChange={(v) =>
                setSettings((prev) => ({ ...prev, vibrationEnabled: v }))
              }
            />
          </div>
          <div className="pt-3">
            <ToggleRow
              label="ブラウザ通知"
              description="バックグラウンドでも通知を受け取る（iPhone Safariは制約あり）"
              checked={settings.browserNotificationEnabled ?? false}
              onChange={(v) => {
                if (v) {
                  handleEnableNotification();
                } else {
                  setSettings((prev) => ({
                    ...prev,
                    browserNotificationEnabled: false,
                  }));
                }
              }}
            />
          </div>
        </div>
      </Card>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleSave}
        loading={saving}
      >
        設定を保存
      </Button>

      {/* Account */}
      <Card>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "#FFFFFF" }}>
          アカウント
        </h2>
        <Button
          variant="danger"
          size="md"
          fullWidth
          onClick={handleLogout}
        >
          ログアウト
        </Button>
      </Card>

      <p className="text-center text-xs pb-4" style={{ color: "#8E8E93" }}>
        筋トレ記録 Version 1.0
      </p>
    </div>
  );
}
