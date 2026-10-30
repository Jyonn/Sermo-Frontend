export function explorerRewardPath(tier: number) {
  if (tier === 1) return "/app/menu?panel=personalization/avatar-frames";
  if (tier === 4) return "/app/menu?panel=personalization/profile-card";
  if (tier === 2 || tier === 3) return `/app/menu?panel=personalization/chat-page&section=${tier === 2 ? "bubbles" : "backgrounds"}`;
  return "/app/menu";
}

export function explorerTaskPath(key: string) {
  if (key === "welcome" || key === "signature") return "/app/menu?panel=basic-info";
  if (key === "phone" || key === "email") return "/app/menu?panel=account-security";
  if (key === "checkin") return "/app/menu?panel=travel-map";
  return "/app/square";
}

export const EXPLORER_ART = {
  banner: "/activity/explorer-2026/banner-v2.webp",
  title: "/activity/explorer-2026/title.webp",
  frame: "/activity/explorer-2026/frame-v2.webp",
  bubble: "/activity/explorer-2026/ai-portrait-v5.webp",
  background: "/activity/explorer-2026/conan-night-v2.webp",
  backgroundAlternate: "/activity/explorer-2026/shinichi-night-v2.webp",
  profile: "/activity/explorer-2026/romance-v2.webp",
  medal: "/activity/explorer-2026/badge-v2.webp",
} as const;

export function explorerRewardArt(tier: number) {
  return [EXPLORER_ART.frame, EXPLORER_ART.bubble, EXPLORER_ART.background, EXPLORER_ART.profile, EXPLORER_ART.medal][tier - 1] ?? EXPLORER_ART.medal;
}

export function explorerRewardThumbnail(tier: number) {
  return explorerRewardArt(tier).replace(/(-v\d+)\.webp$/, "-thumb$1.webp");
}
