import { appearanceAsset } from "./appearanceAsset";

export const musicProfileCards = {
  accusefive: { level: 13, rarity: "rare" },
  "landlords-cat": { level: 14, rarity: "rare" },
  she: { level: 15, rarity: "epic" },
  mayday: { level: 16, rarity: "legendary" },
} as const;

export type MusicProfileCardTheme = keyof typeof musicProfileCards;

export function isMusicProfileCard(value: unknown): value is MusicProfileCardTheme {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(musicProfileCards, value);
}

export function musicProfileAsset(theme: MusicProfileCardTheme, file: "backdrop" | "frames" | "poster") {
  return appearanceAsset(`/assets/profile-card-themes/music/${theme}/${file}.webp`);
}
