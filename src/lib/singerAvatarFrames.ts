export const singerAvatarFrames = {
  "joker-xue": { level: 14, rarity: "epic" },
  "khalil-fong": { level: 15, rarity: "epic" },
  gem: { level: 17, rarity: "legendary" },
  "eason-chan": { level: 18, rarity: "legendary" },
} as const;

export type SingerAvatarFrameStyle = keyof typeof singerAvatarFrames;

export const singerAvatarFrameStyles = Object.keys(singerAvatarFrames) as SingerAvatarFrameStyle[];

export function isSingerAvatarFrame(value: unknown): value is SingerAvatarFrameStyle {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(singerAvatarFrames, value);
}
