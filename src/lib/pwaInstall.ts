interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let installPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
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

export async function requestPwaInstall() {
  if (!installPrompt) return "unavailable" as const;
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  if (choice.outcome === "accepted") installPrompt = null;
  return choice.outcome;
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
