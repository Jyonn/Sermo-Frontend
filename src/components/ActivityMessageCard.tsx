import { useNavigate } from "react-router-dom";
import baxianActivityBanner from "../assets/activity/event-baxian-juli-banner.webp";
import { getActiveLocale, useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import { ActivityCampaignCard } from "./ActivityCampaignCard";
import { NumberDuelCard } from "./NumberDuelCard";
import type { DuelRoomSummary } from "../lib/numberDuel";

interface ActivityMessageCardProps {
  activity?: ActivityCampaignDTO | null;
  activityKey?: string;
  className?: string;
  title?: string;
  roomCode?: string;
  room?: DuelRoomSummary;
}

export function ActivityMessageCard({ activity, activityKey, className, title, roomCode, room }: ActivityMessageCardProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const key = activity?.key || activityKey || "";
  const displayTitle = activity
    ? (getActiveLocale().startsWith("zh") ? activity.title : activity.title_en || activity.title)
    : title || t("message.activityUnavailable");

  if (key === "number-duel-2026") {
    return <NumberDuelCard room={room} className={className} onClick={() => navigate(roomCode ? `/app/number-duel/${roomCode}` : `/app/square/activities/${key}`)} />;
  }
  if (activity?.theme !== "baxian" || activity?.presentation) {
    return <ActivityCampaignCard activity={activity ?? { key, theme: "" }} title={displayTitle} eyebrow={t("message.activityEyebrow")} hint={activity?.active ? t("message.activityOpen") : t("message.activityEnded")} className={`message-activity-card ${className ?? ""}`} disabled={!key} onClick={() => navigate(`/app/square/activities/${key}`)} />;
  }

  return (
    <button
      className={`message-activity-card${activity ? "" : " is-unavailable"}${className ? ` ${className}` : ""}`}
      disabled={!key}
      onClick={(event) => {
        event.stopPropagation();
        if (key) navigate(`/app/square/activities/${key}`);
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
