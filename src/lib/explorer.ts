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
