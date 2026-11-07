const starryBanner = "https://api.sermo.jyonn.space/resources/assets/96/display/197e672103b9d0d35015623505bb5ce2e0cd9a51a657cb121173db61265dbfef";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import {ActivityTitle} from './ActivityCampaignCard';
import {ActivityDetails} from './ActivityDetails';
import { FriendenLivingWallpaper } from "./FriendenLivingWallpaper";

export function StarryNightActivity({ activity, claiming, onClaim, onConfigure }: { activity: ActivityCampaignDTO; claiming: boolean; onClaim: () => void; onConfigure: () => void }) {
  const { t } = useI18n();
  const data = activity.starry_night;
  if (!data) return null;
  const remaining = Math.max(0, data.target_days - data.streak_days);
  const progress = Math.min(100, data.streak_days / Math.max(1, data.target_days) * 100);

  return <div className="starry-night-activity">
    <section className="starry-night-hero">
      <img alt="" src={starryBanner} />
      <div className="starry-night-orbit is-one" /><div className="starry-night-orbit is-two" />
      <div className="starry-night-hero-copy"><small>FIVE NIGHTS · LIVING CANVAS</small><h2><ActivityTitle activity={activity} title={t("activity.starry.title")}/></h2><p>{t("activity.starry.subtitle")}</p><span>{t("growth.rarity.legendary")} · COLLECTION</span></div>
      <div className="starry-night-hero-progress"><strong>{data.streak_days}<small>/ {data.target_days}</small></strong><span>{data.reward_owned ? t("activity.starry.unlocked") : t("activity.starry.nightsLeft", { count: remaining })}</span></div>
    </section>

    <section className="starry-night-journey">
      <header><div><small>NIGHT OBSERVATION</small><h3>{t("activity.starry.currentStreak")}</h3></div><span><i />{t("activity.starry.window")}</span></header>
      <div className="starry-night-route"><i style={{ transform: `scaleX(${progress / 100})` }} />{Array.from({ length: data.target_days }, (_, index) => {
        const lit = index < data.streak_days;
        const current = index === data.streak_days && !data.reward_owned;
        return <article className={`${lit ? "is-lit" : ""}${current ? " is-current" : ""}`} key={index}>
          <span><b>★</b><small>0{index + 1}</small></span>
          <strong>{lit ? t("activity.starry.observed") : current ? t("activity.starry.tonight") : t("activity.starry.waiting")}</strong>
        </article>;
      })}</div>
      <p>{data.reward_owned ? t("activity.starry.completeHint") : data.reward_claimable ? t("activity.starry.rewardReady") : t("activity.starry.continueHint", { count: remaining })}</p>
    </section>

    <aside className="starry-reward-teaser"><img src={starryBanner} alt=""/><div><small>{t('activity.starry.reward')}</small><strong>{t('menu.themeStarryNight')}</strong><span>{t('activity.starry.permanent')}</span></div><b>{data.reward_owned?'✓':`${data.streak_days}/${data.target_days}`}</b></aside>
    <ActivityDetails primary={data.reward_claimable?<button className="activity-primary-action" disabled={claiming} onClick={onClaim} type="button">{t(claiming?'common.processing':'activity.starry.claimReward')}</button>:data.reward_owned?<button className="activity-primary-action" onClick={onConfigure} type="button">{t('activity.configureReward')}</button>:undefined} rules={<section className="starry-night-rules"><ol><li><p>{t('activity.starry.rule1')}</p></li><li><p>{t('activity.starry.rule2')}</p></li></ol></section>} rewards={<section className="starry-night-reward-stage">
      <header><small>COLLECTOR REWARD</small><h3>{t("menu.themeStarryNight")}</h3><p>{t("activity.starry.rewardHint")}</p></header>
      <div className="starry-night-chat-preview">
        <FriendenLivingWallpaper compact theme="starry-night" />
        <span className="starry-night-preview-time">22:18</span>
        <div className="starry-night-preview-message is-left"><i>✦</i><span>{t("activity.starry.previewLeft")}</span></div>
        <div className="starry-night-preview-message is-right"><span>{t("activity.starry.previewRight")}</span><i>☾</i></div>
        <b>{t("growth.rarity.legendary")}</b>
      </div>
      <footer><div><span>{data.reward_owned ? t("activity.starry.unlocked") : data.reward_claimable ? t("activity.starry.rewardReady") : t("activity.starry.reward")}</span><small>{t("activity.starry.permanent")}</small></div>{data.reward_owned ? <button onClick={onConfigure} type="button">{t("activity.configureReward")}<span className="material-symbols-outlined">arrow_forward</span></button> : data.reward_claimable ? <button disabled={claiming} onClick={onClaim} type="button">{claiming ? t("common.processing") : t("activity.starry.claimReward")}<span className="material-symbols-outlined">redeem</span></button> : <span className="starry-night-locked"><span className="material-symbols-outlined">lock</span>{remaining}</span>}</footer>
    </section>}/>
  </div>;
}
