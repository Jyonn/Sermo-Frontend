import { useNavigate } from "react-router-dom";
import {useActivityOverlay} from '../lib/activityOverlay';
const baxianActivityBanner = "/assets/activity/baxian-banner-clean.webp";
import { getActiveLocale, useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import { ActivityCampaignCard } from "./ActivityCampaignCard";
import { NumberDuelCard } from "./NumberDuelCard";
import type { DuelRoomSummary } from "../lib/numberDuel";
import { LANDLORD_KEY } from "../lib/landlord";

interface ActivityMessageCardProps {
  activity?: ActivityCampaignDTO | null;
  activityKey?: string;
  className?: string;
  title?: string;
  roomCode?: string;
  landlordRoom?: string;
  room?: DuelRoomSummary;
}

export function ActivityMessageCard({ activity, activityKey, className, title, roomCode, landlordRoom, room }: ActivityMessageCardProps) {
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
    const eyebrow = landlordRoom ? 'landlord.roomInvite' : key === LANDLORD_KEY ? 'landlord.permanent' : 'message.activityEyebrow';
    const hint = landlordRoom ? 'landlord.join' : activity?.active ? 'message.activityOpen' : 'message.activityEnded';
    return <ActivityCampaignCard activity={activity ?? { key, theme: "" }} title={displayTitle} eyebrow={t(eyebrow)} hint={t(hint)} className={`message-activity-card ${className ?? ""}`} disabled={!key} onClick={() => openActivity(key, landlordRoom)} />;
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
