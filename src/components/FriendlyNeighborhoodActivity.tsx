import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import {ActivityTitle} from './ActivityCampaignCard';
import {ActivityDetails} from './ActivityDetails';
const cityArt = "https://api.sermo.jyonn.space/resources/assets/83/display/6bf6d8746a239a5361f2aa67f6fd05b5d323602337d303d8d4baa2b2748884fc";
const spiderAvatarFrame = "https://api.sermo.jyonn.space/resources/assets/86/display/83de29044d1c4221b1a112452e9b61692a6e74fbc23fbe334ce736be7aaf9c3c";

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
      <div className="friendly-neighbor-hero-copy"><small>FRIENDLY NEIGHBORHOOD</small><h2><ActivityTitle activity={activity} title={t("activity.friendly.title")}/></h2><p>{t("activity.friendly.subtitle")}</p></div>
      <div className="friendly-neighbor-score"><span>{t("activity.friendly.webPoints")}</span><strong>{data.web_points}</strong><small>/ 100</small></div>
    </section>
    <section className="friendly-neighbor-today">
      <header><div><small>{t("activity.friendly.today")}</small><strong>{data.today_points} / {data.daily_limit}</strong></div><span>{data.next_reply_points ? t("activity.friendly.next", { count: data.next_reply_points }) : t("activity.friendly.dailyComplete")}</span></header>
      <div><i style={{ width: `${data.today_points / data.daily_limit * 100}%` }} /></div>
    </section>
    <section className="friendly-reward-journey" aria-label={t('activity.friendly.rewards')}>
      <header><h3>{t('activity.friendly.rewards')}</h3><span>{data.web_points}<small> / 100</small></span></header>
      <div className="friendly-reward-meter"><progress aria-label={t('activity.friendly.webPoints')} value={progress} max={100}/>{data.rewards.map(reward=><span key={reward.key} className={data.web_points>=reward.threshold?'is-reached':''} style={{left:`${reward.threshold}%`}}><i/>{reward.threshold}</span>)}</div>
      <div className="friendly-reward-stops">{data.rewards.map(reward=><article key={reward.key} className={reward.claimed?'is-owned':reward.claimable?'is-ready':''}>
        <div className="friendly-reward-miniature">{reward.resource_type==='frame'?<img src={spiderAvatarFrame} alt=""/>:<img src={cityArt} alt=""/>}</div>
        <div><strong>{t(reward.resource_type==='frame'?'activity.friendly.frame':'activity.friendly.profile')}</strong><small>{reward.threshold} {t('activity.friendly.points')}</small></div>
        {reward.claimable&&!reward.claimed?<button type="button" disabled={claiming!==null} onClick={()=>onClaim(reward.key)}>{t(claiming===reward.key?'common.processing':'activity.friendly.unlock')}</button>:<span>{t(reward.claimed?'activity.friendly.owned':'activity.friendly.locked',{count:Math.max(0,reward.threshold-data.web_points)})}</span>}
      </article>)}</div>
    </section>
    <ActivityDetails rules={<section className="friendly-neighbor-rules"><ol><li>{t("activity.friendly.rule1")}</li><li>{t("activity.friendly.rule2")}</li><li>{t("activity.friendly.rule3")}</li></ol></section>} rewards={<section className="friendly-neighbor-rewards">
      <header><small>YOUR CITY. YOUR LEGACY.</small><h3>{t("activity.friendly.rewards")}</h3></header>
      {data.rewards.map((reward) => <article className={`friendly-neighbor-reward ${reward.key}`} key={reward.key}>
        <div className={`friendly-neighbor-reward-art${reward.resource_type === "frame" ? " is-avatar-frame" : ""}`}>
          {reward.resource_type === "frame"
            ? <img alt="" src={spiderAvatarFrame} />
            : <span className="material-symbols-outlined">motion_photos_on</span>}
        </div>
        <div><small>{reward.threshold} {t("activity.friendly.points")}</small><strong>{t(reward.resource_type === "frame" ? "activity.friendly.frame" : "activity.friendly.profile")}</strong><p>{t(reward.resource_type === "frame" ? "activity.friendly.frameHint" : "activity.friendly.profileHint")}</p></div>
        <button disabled={!reward.claimable || claiming !== null} onClick={() => onClaim(reward.key)} type="button">{reward.claimed ? t("activity.friendly.owned") : reward.claimable ? (claiming === reward.key ? t("common.processing") : t("activity.friendly.unlock")) : t("activity.friendly.locked", { count: Math.max(0, reward.threshold - data.web_points) })}</button>
      </article>)}
    </section>}/>
  </div>;
}
