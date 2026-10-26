export interface ActivityPresentation {
  palette?: "sage" | "rose" | "ocean" | "gold";
  artwork_url?: string;
  title_art_url?: string;
  artwork_layout?: "image" | "keychain-sheet";
}

export function safeActivityImage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 1000 || /[\x00-\x1f\\]/.test(value)) return undefined;
  if (/^\/(?!\/)[^\\]*$/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function activityPresentation(activity?: { key?: string; theme?: string; presentation?: ActivityPresentation } | null): ActivityPresentation {
  const bgm = activity?.theme === "bgm" || activity?.key === "main-character-bgm-2026";
  const duel = activity?.theme === "number_duel" || activity?.key === "number-duel-2026";
  const custom = activity?.presentation;
  return {
    palette: ["sage", "rose", "ocean", "gold"].includes(custom?.palette ?? "") ? custom!.palette : "sage",
    artwork_layout: custom?.artwork_layout === "keychain-sheet" || (!custom?.artwork_url && bgm) ? "keychain-sheet" : "image",
    artwork_url: safeActivityImage(custom?.artwork_url) ?? (bgm ? "/activity/bgm/keychains-v1.png" : undefined),
    title_art_url: safeActivityImage(custom?.title_art_url) ?? (bgm ? "/activity/bgm/title-zh-v1.png" : duel ? "/activity/number-duel/title-zh-v1.webp" : undefined),
  };
}
