/**
 * Singleton AudioContext for reliable audio playback.
 * A shared context, once unlocked by user interaction, continues to work
 * even when the page is in the background on most platforms.
 */
let _ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx) _ctx = new AudioContext();
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
    return _ctx;
  } catch {
    return null;
  }
}

/** Call on any user gesture to unlock audio for future background playback. */
export function unlockAudio(): void {
  getContext();
}

/** Play the interval-finish beep (880→660→880 Hz, 0.5s). */
export function playFinishBeep(enabled: boolean): void {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // ignore
  }
}
