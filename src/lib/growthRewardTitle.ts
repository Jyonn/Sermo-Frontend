import type { GrowthRewardDTO } from "../types";
import type { TranslationKey } from "./i18n";
import { isMusicProfileCard } from "./musicProfileCards";
import { isSingerAvatarFrame } from "./singerAvatarFrames";

export function growthRewardTitle(reward: GrowthRewardDTO, translate: (key: TranslationKey) => string) {
  if (reward.category === "profile" && isMusicProfileCard(reward.asset_key)) {
    return translate(`menu.profileCardTheme.${reward.asset_key}`);
  }
  if (reward.category === "frame" && isSingerAvatarFrame(reward.asset_key)) {
    return translate(`menu.singerFrame.${reward.asset_key}`);
  }
  return reward.title;
}
