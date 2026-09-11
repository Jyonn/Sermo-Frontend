import starryBanner from "../assets/activity/starry-night/banner.webp";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";

export function StarryNightActivity({ activity, onConfigure }: { activity: ActivityCampaignDTO; onConfigure: () => void }) {
  const { t } = useI18n();
  const data = activity.starry_night;
  if (!data) return null;
  const progress = Math.min(100, data.streak_days / Math.max(1, data.target_days) * 100);

  return <div className="starry-night-activity">
    <section className="starry-night-hero">
      <img alt="" src={starryBanner} />
      <div><small>FRIENDEN NIGHT VOYAGE</small><h2>{t("activity.starry.title")}</h2><p>{t("activity.starry.subtitle")}</p></div>
      <span>{t("growth.rarity.legendary")}</span>
    </section>
    <section className="starry-night-progress">
      <header><div><small>{t("activity.starry.currentStreak")}</small><strong>{data.streak_days}<span> / {data.target_days}</span></strong></div><b>{data.reward_owned ? t("activity.starry.unlocked") : t("activity.starry.nightsLeft", { count: Math.max(0, data.target_days - data.streak_days) })}</b></header>
      <div className="starry-night-track"><i style={{ width: `${progress}%` }} />{Array.from({ length: data.target_days }, (_, index) => <span className={index < data.streak_days ? "is-lit" : ""} key={index}>★</span>)}</div>
      <p>{t("activity.starry.window")}</p>
    </section>
    <section className="starry-night-reward">
      <div className="starry-night-reward-preview"><i /><i /><i /></div>
      <div><small>{t("activity.starry.reward")}</small><strong>{t("menu.themeStarryNight")}</strong><span>{t("activity.starry.rewardHint")}</span></div>
      {data.reward_owned ? <button onClick={onConfigure} type="button">{t("activity.configureReward")}<span className="material-symbols-outlined">arrow_forward</span></button> : null}
    </section>
    <section className="starry-night-rules"><strong>{t("activity.starry.rules")}</strong><p>{t("activity.starry.rule1")}</p><p>{t("activity.starry.rule2")}</p></section>
  </div>;
}
