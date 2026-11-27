import { useEffect, useState } from "react";
import { activityPresentation } from "../lib/activityPresentation";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import {isFourPlayerGame} from '../lib/tabletop';
import "./ActivityCampaignCard.css";

export function ActivityTitle({ activity, title }: { activity?: Pick<ActivityCampaignDTO, "key" | "theme" | "presentation"> | null; title: string }) {
  const { language } = useI18n();
  const [failed, setFailed] = useState(false);
  const image = activityPresentation(activity).title_art_url;
  useEffect(() => setFailed(false), [image]);
  return image && language.startsWith("zh") && !failed
    ? <img className="campaign-title-art" src={image} alt={title} onError={() => setFailed(true)} />
    : <strong className="campaign-title-text">{title}</strong>;
}

export function ActivityCampaignCard({ activity, title, eyebrow, hint, progress, className = "", disabled, onClick }: {
  activity?: Pick<ActivityCampaignDTO, "key" | "theme" | "presentation"> | null;
  title: string; eyebrow: string; hint: string; progress?: { value: number; max: number; label?: string }; className?: string; disabled?: boolean; onClick: () => void;
}) {
  const visual = activityPresentation(activity);
  const explorer = activity?.key === "explorer-2026" || activity?.theme === "explorer";
  const recordShop = activity?.key === "record-shop" || activity?.key === "record-shop-women" || activity?.theme === "record-shop";
  const landlord = activity?.key === "landlord" || activity?.theme === "landlord";
  const game = isFourPlayerGame(activity?.key) ? activity.key : null;
  return <button type="button" disabled={disabled} onClick={(event) => { event.stopPropagation(); onClick(); }} className={`${className} campaign-card palette-${visual.palette}${explorer ? " is-explorer" : ""}${recordShop ? " is-record-shop" : ""}${landlord ? " is-landlord" : ""}${game ? ` is-${game}` : ""}`}>
    <span className="campaign-card-copy"><small>{eyebrow}</small><ActivityTitle activity={activity} title={title} /><span>{hint}</span></span>
    {visual.artwork_url ? <span className={`campaign-card-object is-${visual.artwork_layout}`} style={{ backgroundImage: `url(${JSON.stringify(visual.artwork_url)})` }} aria-hidden="true" /> : <span className="campaign-card-symbol" aria-hidden="true">{game === 'mahjong' ? '中' : game === 'shuangkou' ? '♦' : '✦'}</span>}
    <span className="campaign-card-arrow material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    {progress ? <span className="campaign-card-progress"><b>{progress.value}<small> / {progress.max}</small></b><progress value={progress.value} max={Math.max(1, progress.max)} aria-label={progress.label ?? title} /></span>:null}
  </button>;
}
