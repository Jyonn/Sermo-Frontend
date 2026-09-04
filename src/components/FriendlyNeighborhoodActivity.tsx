import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import cityArt from "../assets/activity/friendly-neighborhood/event-city.webp";
import spiderAvatarFrame from "../assets/activity/friendly-neighborhood/spider-avatar-frame-512.webp";

interface Props {
  activity: ActivityCampaignDTO;
  claiming: string | null;
  onClaim: (rewardKey: string) => void;
}

export function FriendlyNeighborhoodActivity({ activity, claiming, onClaim }: Props) {
  const { t } = useI18n();
  const data = activity.friendly_neighbor;
  if (!data) return null;
  const progress = Math.min(100, data.web_points);

  return <div className="friendly-neighbor-activity">
    <section className="friendly-neighbor-hero">
      <img alt="" src={cityArt} />
      <div className="friendly-neighbor-hero-copy"><small>FRIENDLY NEIGHBORHOOD</small><h2>{t("activity.friendly.title")}</h2><p>{t("activity.friendly.subtitle")}</p></div>
      <div className="friendly-neighbor-score"><span>{t("activity.friendly.webPoints")}</span><strong>{data.web_points}</strong><small>/ 100</small></div>
    </section>
    <section className="friendly-neighbor-today">
      <header><div><small>{t("activity.friendly.today")}</small><strong>{data.today_points} / {data.daily_limit}</strong></div><span>{data.next_reply_points ? t("activity.friendly.next", { count: data.next_reply_points }) : t("activity.friendly.dailyComplete")}</span></header>
      <div><i style={{ width: `${data.today_points / data.daily_limit * 100}%` }} /></div>
    </section>
    <section className="friendly-neighbor-rewards">
      <header><small>YOUR CITY. YOUR LEGACY.</small><h3>{t("activity.friendly.rewards")}</h3></header>
      <div className="friendly-neighbor-track"><i style={{ width: `${progress}%` }} />{data.rewards.map((reward) => <article className={`${reward.claimed ? "is-claimed" : reward.claimable ? "is-ready" : ""}`} key={reward.key} style={{ left: `${reward.threshold}%` }}><span>{reward.threshold}</span></article>)}</div>
      {data.rewards.map((reward) => <article className={`friendly-neighbor-reward ${reward.key}`} key={reward.key}>
        <div className={`friendly-neighbor-reward-art${reward.resource_type === "frame" ? " is-avatar-frame" : ""}`}>
          {reward.resource_type === "frame"
            ? <img alt="" src={spiderAvatarFrame} />
            : <span className="material-symbols-outlined">motion_photos_on</span>}
        </div>
        <div><small>{reward.threshold} {t("activity.friendly.points")}</small><strong>{t(reward.resource_type === "frame" ? "activity.friendly.frame" : "activity.friendly.profile")}</strong><p>{t(reward.resource_type === "frame" ? "activity.friendly.frameHint" : "activity.friendly.profileHint")}</p></div>
        <button disabled={!reward.claimable || claiming !== null} onClick={() => onClaim(reward.key)} type="button">{reward.claimed ? t("activity.friendly.owned") : reward.claimable ? (claiming === reward.key ? t("common.processing") : t("activity.friendly.unlock")) : t("activity.friendly.locked", { count: Math.max(0, reward.threshold - data.web_points) })}</button>
      </article>)}
    </section>
    <section className="friendly-neighbor-rules"><h3>{t("activity.friendly.rules")}</h3><ol><li>{t("activity.friendly.rule1")}</li><li>{t("activity.friendly.rule2")}</li><li>{t("activity.friendly.rule3")}</li></ol></section>
  </div>;
}
