import { useNavigate } from "react-router-dom";
import baxianActivityBanner from "../assets/activity/event-baxian-juli-banner.webp";
import { getActiveLocale, useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import { ActivityCampaignCard } from "./ActivityCampaignCard";

interface ActivityMessageCardProps {
  activity?: ActivityCampaignDTO | null;
  activityKey?: string;
  className?: string;
  title?: string;
}

export function ActivityMessageCard({ activity, activityKey, className, title }: ActivityMessageCardProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const key = activity?.key || activityKey || "";
  const displayTitle = activity
    ? (getActiveLocale().startsWith("zh") ? activity.title : activity.title_en || activity.title)
    : title || t("message.activityUnavailable");

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
