import { useState } from "react";
import { ExplorerAiExpression } from "./ExplorerAiExpression";
import { useAuth } from "../lib/auth";
import { EXPLORER_ART, explorerRewardThumbnail } from "../lib/explorer";
import { useI18n, type TranslationKey } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import { FriendenLivingWallpaper } from "./FriendenLivingWallpaper";
import { UserAvatar } from "./UserAvatar";
import { UserProfileCard } from "./UserProfileCard";

type ExplorerReward = NonNullable<ActivityCampaignDTO["explorer"]>["rewards"][number];

// Show the actual wearable components, not a separate marketing approximation.
export function ExplorerRewardPreview({ tier }: { tier: number }) {
  const { session } = useAuth();
  const { t } = useI18n();
  const name = session?.user.name ?? t("explorer.previewName");
  return <div className={`explorer-showcase tier-${tier}`}>
    {tier === 1 ? <div className="explorer-frame-display">
      <span className="explorer-display-orbit" aria-hidden="true" />
      <UserAvatar className="explorer-avatar-preview" frame="explorer-conan" name={name} uri={session?.user.avatar_uri} />
      <strong>{name}</strong><span>{t("explorer.specimen.frame")}</span>
    </div> : tier === 2 ? <div className="explorer-chat-display personalization-bubble-stage bubble-style-explorer-ai">
      <span className="explorer-specimen-label">{t("explorer.specimen.bubble")}</span>
      <div className="explorer-sample-message message-group bubble-style-explorer-ai other"><UserAvatar className="explorer-sample-avatar" name={name} uri={session?.user.avatar_uri} /><div><small>{name}</small><div className="message-bubble-shell other"><div className="message-bubble group-end explorer-bubble-preview"><ExplorerAiExpression messageKey="gallery-other" bubbleStyle="explorer-ai"><span>{t("explorer.previewLine")}</span></ExplorerAiExpression></div></div></div></div>
      <div className="explorer-sample-message message-group bubble-style-explorer-ai self"><div className="message-bubble-shell self"><div className="message-bubble group-end explorer-bubble-preview"><ExplorerAiExpression messageKey="gallery-self" bubbleStyle="explorer-ai"><span>{t("explorer.previewReply")}</span></ExplorerAiExpression></div></div></div>
    </div> : tier === 3 ? <div className="explorer-wallpaper-display">
      <FriendenLivingWallpaper theme="explorer-duality" />
      <span className="explorer-specimen-label">{t("explorer.specimen.background")}</span>
      <div className="explorer-wallpaper-messages"><span>{t("explorer.previewLine")}</span><span>{t("explorer.previewReply")}</span></div>
      <span className="explorer-scene-caption">{t("explorer.sceneTransition")}</span>
    </div> : tier === 4 ? <div className="explorer-profile-display user-profile-panel profile-theme-explorer-romance">
      <UserProfileCard profileTheme="explorer-romance" name={name} avatarUri={session?.user.avatar_uri} avatarFrame="explorer-conan" presence={t("explorer.profileSignature")} />
    </div> : <div className="explorer-medal-display">
      <span className="explorer-display-orbit" aria-hidden="true" />
      <img alt={t("explorer.reward.5")} src={EXPLORER_ART.medal} />
      <span>{t("explorer.specimen.medal")}</span>
    </div>}
  </div>;
}

export function ExplorerRewardGallery({ rewards, onConfigure, onTasks }: { rewards: ExplorerReward[]; onConfigure: (tier: number) => void; onTasks: () => void }) {
  const { t } = useI18n();
  const [tier, setTier] = useState(1);
  const reward = rewards.find((item) => item.tier === tier) ?? rewards[0];
  if (!reward) return null;
  const tr = (key: string) => t(`explorer.${key}` as TranslationKey);
  return <div className="explorer-collection">
    <header className="explorer-collection-heading"><span>{tr("collectionEdition")}</span><p>{tr("collectionIntro")}</p></header>
    <div className="explorer-collection-picker" aria-label={tr("viewRewards")}>
      {rewards.map((item) => <button type="button" key={item.tier} aria-pressed={item.tier === reward.tier} aria-label={`${tr(`reward.${item.tier}`)} · ${item.claimed ? tr("owned") : t("explorer.unlockAt", { count: item.tier })}`} onClick={() => setTier(item.tier)}>
        <img alt="" src={explorerRewardThumbnail(item.tier)} /><span>0{item.tier}</span><i className="material-symbols-outlined" aria-hidden="true">{item.claimed ? "check_circle" : "lock"}</i>
      </button>)}
    </div>
    <article className={`explorer-collection-piece rarity-${reward.rarity}`}>
      <div className="explorer-piece-number"><span>{tr("collectionPiece")}</span><strong>0{reward.tier}<small> / 05</small></strong></div>
      <ExplorerRewardPreview key={reward.tier} tier={reward.tier} />
      <div className="explorer-piece-copy">
        <div className="explorer-piece-tags"><span>{t(`growth.rarity.${reward.rarity}` as TranslationKey)}</span><span>{tr(`type.${reward.resource_type}`)}</span><span>{tr("permanent")}</span></div>
        <h3>{tr(`reward.${reward.tier}`)}</h3><p>{tr(`detail.${reward.tier}`)}</p>
        <button className="explorer-collection-action" disabled={reward.claimed && reward.tier === 5} onClick={() => reward.claimed ? onConfigure(reward.tier) : onTasks()} type="button"><span>{reward.claimed ? reward.tier === 5 ? tr("owned") : t("activity.configureReward") : t("explorer.unlockAt", { count: reward.tier })}</span><span className="material-symbols-outlined" aria-hidden="true">{reward.claimed ? "check_circle" : "arrow_forward"}</span></button>
      </div>
    </article>
  </div>;
}
