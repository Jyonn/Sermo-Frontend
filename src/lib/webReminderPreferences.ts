export interface WebReminderPreferences {
  soundEnabled: boolean;
  titleEnabled: boolean;
}

const WEB_REMINDER_PREFS_KEY = "sermo-web-reminder-prefs";
export const WEB_REMINDER_PREFS_UPDATED_EVENT = "sermo:web-reminder-prefs-updated";

const defaultPreferences: WebReminderPreferences = {
  soundEnabled: true,
  titleEnabled: true,
};

let audioContext: AudioContext | null = null;
let audioUnlockInstalled = false;

function parsePreferences(value: string | null): WebReminderPreferences {
  if (!value) return defaultPreferences;
  try {
    const parsed = JSON.parse(value) as Partial<WebReminderPreferences>;
    return {
      soundEnabled: typeof parsed.soundEnabled === "boolean" ? parsed.soundEnabled : defaultPreferences.soundEnabled,
      titleEnabled: typeof parsed.titleEnabled === "boolean" ? parsed.titleEnabled : defaultPreferences.titleEnabled,
    };
  } catch {
    return defaultPreferences;
  }
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

function unlockAudioContext() {
  const context = getAudioContext();
  if (!context || context.state !== "suspended") return;
  void context.resume().catch(() => undefined);
}

export function installWebReminderAudioUnlock() {
  if (audioUnlockInstalled || typeof window === "undefined") return;
  audioUnlockInstalled = true;

  const unlock = () => unlockAudioContext();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

export function getWebReminderPreferences(): WebReminderPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  return parsePreferences(window.localStorage.getItem(WEB_REMINDER_PREFS_KEY));
}

export function setWebReminderPreferences(next: WebReminderPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEB_REMINDER_PREFS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<WebReminderPreferences>(WEB_REMINDER_PREFS_UPDATED_EVENT, { detail: next }));
}

export function playWebReminderSound() {
  if (!getWebReminderPreferences().soundEnabled) return;

  const context = getAudioContext();
  if (!context) return;

  void context.resume().then(() => {
    const now = context.currentTime;
    const gain = context.createGain();
    const firstTone = context.createOscillator();
    const secondTone = context.createOscillator();

    firstTone.type = "sine";
    firstTone.frequency.setValueAtTime(740, now);
    secondTone.type = "sine";
    secondTone.frequency.setValueAtTime(980, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    firstTone.connect(gain);
    secondTone.connect(gain);
    gain.connect(context.destination);

    firstTone.start(now);
    firstTone.stop(now + 0.15);
    secondTone.start(now + 0.08);
    secondTone.stop(now + 0.28);

    window.setTimeout(() => {
      firstTone.disconnect();
      secondTone.disconnect();
      gain.disconnect();
    }, 360);
  }).catch(() => undefined);
}
