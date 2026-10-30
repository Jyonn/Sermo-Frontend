import { useState } from "react";
import { activityPresentation } from "../lib/activityPresentation";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import "./ActivityCampaignCard.css";

export function ActivityTitle({ activity, title }: { activity?: Pick<ActivityCampaignDTO, "key" | "theme" | "presentation"> | null; title: string }) {
  const { language } = useI18n();
  const [failed, setFailed] = useState(false);
  const image = activityPresentation(activity).title_art_url;
  return image && language.startsWith("zh") && !failed
    ? <img className="campaign-title-art" src={image} alt={title} onError={() => setFailed(true)} />
    : <strong className="campaign-title-text">{title}</strong>;
}

export function ActivityCampaignCard({ activity, title, eyebrow, hint, className = "", disabled, onClick }: {
  activity?: Pick<ActivityCampaignDTO, "key" | "theme" | "presentation"> | null;
  title: string; eyebrow: string; hint: string; className?: string; disabled?: boolean; onClick: () => void;
}) {
  const visual = activityPresentation(activity);
  const explorer = activity?.key === "explorer-2026" || activity?.theme === "explorer";
  return <button type="button" disabled={disabled} onClick={(event) => { event.stopPropagation(); onClick(); }} className={`${className} campaign-card palette-${visual.palette}${explorer ? " is-explorer" : ""}`}>
    <span className="campaign-card-copy"><small>{eyebrow}</small><ActivityTitle activity={activity} title={title} /><span>{hint}</span></span>
    {visual.artwork_url ? <span className={`campaign-card-object is-${visual.artwork_layout}`} style={{ backgroundImage: `url(${JSON.stringify(visual.artwork_url)})` }} aria-hidden="true" /> : <span className="campaign-card-symbol" aria-hidden="true">✦</span>}
    <span className="campaign-card-arrow material-symbols-outlined" aria-hidden="true">arrow_forward</span>
  </button>;
}
