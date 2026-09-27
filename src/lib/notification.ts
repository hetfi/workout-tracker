/** Request notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Show a push notification via the service worker.
 * Works even when the screen is locked (Android PWA, iOS 16.4+ PWA home screen).
 */
export async function showTimerNotification(
  exerciseName: string,
  nextSetNumber: number
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("インターバル終了！", {
      body: `${exerciseName} — ${nextSetNumber}セット目を開始してください`,
      icon: "/icon.png",
      tag: "interval-timer",
      renotify: true,
      silent: false,
    } as NotificationOptions);
  } catch {
    // Fallback: in-page notification (foreground only)
    if (Notification.permission === "granted") {
      new Notification("インターバル終了！", {
        body: `${exerciseName} — ${nextSetNumber}セット目を開始してください`,
        icon: "/icon.png",
        tag: "interval-timer",
      });
    }
  }
}
