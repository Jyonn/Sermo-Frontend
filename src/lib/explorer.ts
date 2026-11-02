import {activityAsset} from './activityAsset.ts';
import {explorerExpressionSrc,explorerExpressionDisplaySrc} from './explorerExpressions.ts';
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
  banner: "https://api.sermo.jyonn.space/resources/assets/61/display/3bc14b190070ff1eb1dcf00f1940f053548e913865ceb4d1f37cdf88641223f7",
  title: "https://api.sermo.jyonn.space/resources/assets/76/display/8cc080b5d91ecf861bdf4dbaedc1846eecfb4f73c7de73874d5b8f776a144260",
  frame: "https://api.sermo.jyonn.space/resources/assets/66/display/95f72390ed58b1edbf8d7278d4ea0b5c2bd644856d3ada4959a3616b0358005a",
  bubble: explorerExpressionDisplaySrc('cool'),
  background: "https://api.sermo.jyonn.space/resources/assets/63/display/39a1c869fb7c1b494fd13cf3638a84998d19b5dcfd21feda18e7afb4e49ac184",
  backgroundAlternate: "https://api.sermo.jyonn.space/resources/assets/74/display/c198e7c161d1930c8859d600e1af60145f71b6a8eaa1d1efb898647339d7e216",
  profile: "https://api.sermo.jyonn.space/resources/assets/71/display/e872798c26456da5d450f57d3db1e7f4638f94b86de62a5ce0da271b348266ee",
  medal: "https://api.sermo.jyonn.space/resources/assets/59/display/78375e5cd9fc9a864cd6aba1ec328bd64f5aea5248b713818f2358b77b5d4f19",
} as const;

export function explorerRewardArt(tier: number) {
  return [EXPLORER_ART.frame, EXPLORER_ART.bubble, EXPLORER_ART.background, EXPLORER_ART.profile, EXPLORER_ART.medal][tier - 1] ?? EXPLORER_ART.medal;
}

export function explorerRewardThumbnail(tier: number) {
  if (tier === 2) return explorerExpressionSrc('cool');
  return activityAsset(['/activity/explorer-2026/frame-thumb-v2.webp','','/activity/explorer-2026/conan-night-thumb-v2.webp','/activity/explorer-2026/romance-thumb-v2.webp','/activity/explorer-2026/badge-thumb-v2.webp'][tier-1]??'/activity/explorer-2026/badge-thumb-v2.webp');
}
