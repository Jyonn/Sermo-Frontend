interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let installPrompt: BeforeInstallPromptEvent | null = null;
export const PWA_INSTALL_STATE_EVENT = "sermo:pwa-install-state";

function emitInstallState() {
  window.dispatchEvent(new CustomEvent(PWA_INSTALL_STATE_EVENT, {
    detail: { available: Boolean(installPrompt), installed: isStandalonePwa() },
  }));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
    emitInstallState();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    emitInstallState();
  });
}

export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isDesktopChrome() {
  if (typeof navigator === "undefined") return false;
  const chrome = /Chrome|Chromium/.test(navigator.userAgent) && !/Edg|OPR/.test(navigator.userAgent);
  return chrome && !/Android|iPhone|iPad|iPod|Mobile/.test(navigator.userAgent);
}

export function isAndroidDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function isChromiumBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Chrome|Chromium/i.test(navigator.userAgent) && !/Edg|OPR|SamsungBrowser/i.test(navigator.userAgent);
}

export function canPromptPwaInstall() {
  return Boolean(installPrompt);
}

function waitForInstallPrompt(timeout = 1800) {
  if (installPrompt) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const onState = () => {
      if (!installPrompt) return;
      window.clearTimeout(timer);
      window.removeEventListener(PWA_INSTALL_STATE_EVENT, onState);
      resolve(true);
    };
    const timer = window.setTimeout(() => {
      window.removeEventListener(PWA_INSTALL_STATE_EVENT, onState);
      resolve(Boolean(installPrompt));
    }, timeout);
    window.addEventListener(PWA_INSTALL_STATE_EVENT, onState);
  });
}

export async function requestPwaInstall() {
  if (!installPrompt && isChromiumBrowser()) await waitForInstallPrompt(3000);
  if (!installPrompt) return "unavailable" as const;
  const prompt = installPrompt;
  installPrompt = null;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    emitInstallState();
    return choice.outcome;
  } catch {
    emitInstallState();
    return "unavailable" as const;
  }
}

export function markPwaRecommendationShown(slug: string, kind: "install" | "push") {
  try {
    localStorage.setItem(`sermo:pwa-recommendation:${slug}:${kind}`, "1");
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

export function wasPwaRecommendationShown(slug: string, kind: "install" | "push") {
  try {
    return localStorage.getItem(`sermo:pwa-recommendation:${slug}:${kind}`) === "1";
  } catch {
    return false;
  }
}
