import { useNavigate } from "react-router-dom";
import {useActivityOverlay} from '../lib/activityOverlay';
const baxianActivityBanner = "/assets/activity/baxian-banner-clean.webp";
import { getActiveLocale, useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import { ActivityCampaignCard } from "./ActivityCampaignCard";
import { NumberDuelCard } from "./NumberDuelCard";
import type { DuelRoomSummary } from "../lib/numberDuel";
import { isTabletopGame } from "../lib/tabletop";

interface ActivityMessageCardProps {
  activity?: ActivityCampaignDTO | null;
  activityKey?: string;
  className?: string;
  title?: string;
  roomCode?: string;
  tableRoom?: string;
  room?: DuelRoomSummary;
}

export function ActivityMessageCard({ activity, activityKey, className, title, roomCode, tableRoom, room }: ActivityMessageCardProps) {
  const navigate = useNavigate();
  const openActivity=useActivityOverlay();
  const { t } = useI18n();
  const key = activity?.key || activityKey || "";
  const displayTitle = activity
    ? (getActiveLocale().startsWith("zh") ? activity.title : activity.title_en || activity.title)
    : title || t("message.activityUnavailable");

  if (key === "number-duel-2026") {
    return <NumberDuelCard room={room} className={className} onClick={() => roomCode ? navigate(`/app/number-duel/${roomCode}`) : openActivity(key)} />;
  }
  if (activity?.theme !== "baxian" || activity?.presentation) {
    const eyebrow = tableRoom ? key === 'landlord' ? 'landlord.roomInvite' : 'tabletop.invitation' : isTabletopGame(key) ? 'landlord.permanent' : 'message.activityEyebrow';
    const hint = tableRoom ? 'landlord.takeSeat' : isTabletopGame(key) && activity?.active ? 'landlord.openLobby' : activity?.active ? 'message.activityOpen' : 'message.activityEnded';
    return <ActivityCampaignCard activity={activity ?? { key, theme: "" }} title={displayTitle} eyebrow={t(eyebrow)} hint={t(hint)} className={`message-activity-card ${className ?? ""}`} disabled={!key} onClick={() => openActivity(key, tableRoom)} />;
  }

  return (
    <button
      className={`message-activity-card${activity ? "" : " is-unavailable"}${className ? ` ${className}` : ""}`}
      disabled={!key}
      onClick={(event) => {
        event.stopPropagation();
        if (key) openActivity(key);
      }}
      type="button"
    >
      <img alt="" src={baxianActivityBanner} />
      <span className="message-activity-shade" />
      <span className="message-activity-copy">
        <small>{t("message.activityEyebrow")}</small>
        <strong>{displayTitle}</strong>
        <span>{activity?.active ? t("message.activityOpen") : t("message.activityEnded")}</span>
      </span>
      <span className="message-activity-enter material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </button>
  );
}
