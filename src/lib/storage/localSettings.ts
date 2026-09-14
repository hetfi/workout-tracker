/**
 * ブラウザの localStorage に保存するクライアント側設定。
 * DB への永続化が不要な、UI/UX 系のオン/オフ設定に使う。
 */

const INTERVAL_ENABLED_KEY = "workout_interval_enabled";

/** インターバルタイマーを使用するかどうか（デフォルト: true） */
export function getIntervalEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(INTERVAL_ENABLED_KEY);
  return v === null ? true : v === "true";
}

export function setIntervalEnabled(v: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INTERVAL_ENABLED_KEY, String(v));
}
