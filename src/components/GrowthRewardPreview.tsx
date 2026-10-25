import { useI18n } from "../lib/language";
import type { AvatarFrameStyle, ChatBackgroundTheme, ChatBubbleStyle, GrowthRewardDTO } from "../types";
import ChatsPage from "../pages/ChatsPage";
import { UserAvatar } from "./UserAvatar";
import { GrowthHonor } from "./GrowthHonor";
import "./GrowthExperience.css";

export function GrowthRewardPreview({ reward, compact = false, name = "FRIENDEN", uri }: { reward: GrowthRewardDTO; compact?: boolean; name?: string; uri?: string }) {
  const { t } = useI18n();
  const asset = reward.asset_key ?? "default";
  const isChat = reward.category === "background" || reward.category === "bubble";
  return <div className={`growth-sample is-${reward.category}${compact ? " is-thumbnail" : ""}`} aria-hidden="true">
    {reward.category === "frame" ? <UserAvatar className="growth-sample-avatar" frame={asset as AvatarFrameStyle} name={name} uri={uri} /> : isChat ? compact ? (
      reward.category === "background" ? <span className={`growth-sample-wallpaper chat-background-choice theme-${asset}`}><span /></span> : <span className="growth-sample-bubble field-chat_bubble_style"><span className={`personalization-option preview-${asset}`}><i><span /></i></span></span>
    ) : <div className="growth-sample-conversation"><ChatsPage preview={{ avatarName: name, avatarUri: uri, backgroundTheme: reward.category === "background" ? asset as ChatBackgroundTheme : "default", bubbleStyle: reward.category === "bubble" ? asset as ChatBubbleStyle : "default", selfOnly: true, dialogue: [{ from: "other", text: t("menu.bubblePreviewOther") }, { from: "self", text: t("menu.bubblePreviewSelf") }] }} /></div> : reward.id === "profile.final_slot" || reward.id === "identity.final_badge" ? compact ? <span className="growth-sample-symbol">18</span> : <GrowthHonor honor={{ level: 18, name: t("growth.maxLevel") }} /> : <span className="material-symbols-outlined growth-sample-symbol">{reward.id === "growth.report" ? "insights" : reward.category === "identity" ? "workspace_premium" : "lock_open"}</span>}
  </div>;
}
