import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { explorerRewardPath, explorerTaskPath } from "../lib/explorer";
import { useAuth } from "../lib/auth";
import { isChineseLanguage } from "../lib/i18n";
import { useI18n, type TranslationKey } from "../lib/language";
import { showToast } from "../lib/toast";
import type { ActivityCampaignDTO } from "../types";
import { ActivityTitle } from "./ActivityCampaignCard";
import { BottomSheet } from "./BottomSheet";
import { ChronellePluginDialog } from "./ChronellePluginDialog";
import { UserAvatar } from "./UserAvatar";
import "./ExplorerActivity.css";

const assets = "/activity/explorer-2026/";
const rewardArt = ["frame.webp", "ai.webp", "conan-night.webp", "romance.webp", "badge.webp"];
const themeIcons = { basic: "person_edit", security: "verified_user", apps: "extension", square: "edit_square", activity: "flag" };

export function ExplorerBanner({ activity, onClick }: { activity: ActivityCampaignDTO; onClick: () => void }) {
  const { t } = useI18n();
  return <button className="square-activity-banner explorer-banner" onClick={onClick} type="button">
    <img alt="" className="explorer-banner-scene" src={`${assets}conan-night.webp`} />
    <span className="explorer-banner-copy"><ActivityTitle activity={activity} title={t("explorer.title")} /><small>{t("explorer.banner")}</small></span>
    <span className="explorer-banner-progress"><b>{activity.explorer?.completed_count ?? 0}<small>/5</small></b><span>{activity.explorer?.rewards.some((reward) => reward.claimable) ? t("activity.pendingClaim") : t("explorer.themes")}</span></span>
  </button>;
}

export function ExplorerActivity({ activity, onUpdate, onPublish }: { activity: ActivityCampaignDTO; onUpdate: (activity: ActivityCampaignDTO) => void; onPublish: () => void }) {
  const { t, language } = useI18n();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"tasks" | "rewards" | "rules" | null>(null);
  const [busy, setBusy] = useState(false);
  const [chronelleOpen, setChronelleOpen] = useState(false);
  const data = activity.explorer;
  const tr = (key: string) => t(`explorer.${key}` as TranslationKey);
  const refresh = () => api.getActivity(activity.key).then(onUpdate).catch(() => undefined);
  useEffect(() => {
    const controller = new AbortController();
    const reload = () => { if (!document.hidden) void api.getActivity(activity.key, controller.signal).then(onUpdate).catch(() => undefined); };
    window.addEventListener("focus", reload);
    window.addEventListener("chronelle:bound", reload);
    document.addEventListener("visibilitychange", reload);
    return () => { controller.abort(); window.removeEventListener("focus", reload); window.removeEventListener("chronelle:bound", reload); document.removeEventListener("visibilitychange", reload); };
  }, [activity.key, onUpdate]);
  if (!data) return null;
  const next = data.rewards.find((reward) => !reward.claimed);
  const claim = async () => {
    if (!next?.claimable || busy) return;
    setBusy(true);
    try { onUpdate(await api.claimExplorerReward(activity.key, next.tier)); showToast(tr("claimed")); }
    catch (error) { showToast(error instanceof Error ? error.message : t("common.saveFailed"), "error"); }
    finally { setBusy(false); }
  };
  const task = (key: string) => {
    setPanel(null);
    if (key === "chronelle") { setChronelleOpen(true); return; }
    if (key === "publish") { onPublish(); return; }
    navigate(explorerTaskPath(key));
  };
  const configure = (tier: number) => navigate(explorerRewardPath(tier));
  return <div className="explorer-activity">
    <section className="explorer-hero">
      <img alt="" className="explorer-hero-scene" src={`${assets}conan-night.webp`} />
      <div className="explorer-hero-copy"><span className="explorer-edition">{tr("edition")}</span>{isChineseLanguage(language) ? <img className="explorer-wordmark" alt={tr("title")} src={`${assets}title.webp`} /> : <h2>{tr("title")}</h2>}<p>{tr("intro")}</p><time>{tr("dates")}</time></div>
      <span className="explorer-case-number" aria-hidden="true">CASE / 2026</span>
    </section>
    <section className="explorer-passport">
      <header><div><small>{tr("passport")}</small><h3>{tr("progress")}</h3></div><strong>{data.completed_count}<small>/5</small></strong></header>
      <div className="explorer-stamps">{data.themes.map((theme, index) => <button aria-label={`${tr(`theme.${theme.key}`)}: ${theme.completed ? tr("done") : tr("pending")}`} className={theme.completed ? "is-complete" : ""} key={theme.key} onClick={() => { setPanel("tasks"); void refresh(); }} type="button"><span className="material-symbols-outlined">{theme.completed ? "check" : themeIcons[theme.key]}</span><b>{tr(`theme.${theme.key}`)}</b><small>0{index + 1}</small></button>)}</div>
      <button className="explorer-text-action" onClick={() => { setPanel("tasks"); void refresh(); }} type="button">{tr("viewTasks")}<span className="material-symbols-outlined">arrow_forward</span></button>
    </section>
    <section className="explorer-next-reward">
      <div className="explorer-next-art"><img alt="" src={`${assets}${rewardArt[(next?.tier ?? 5) - 1]}`} /></div>
      <div><small>{next ? tr("nextReward") : tr("collectionComplete")}</small><h3>{tr(`reward.${next?.tier ?? 5}`)}</h3><span>{next ? t(`growth.rarity.${next.rarity}` as TranslationKey) : tr("permanent")}</span></div>
      <button className="primary-button" disabled={busy || Boolean(next && (!next.claimable || !activity.active))} onClick={() => next ? void claim() : setPanel("rewards")} type="button">{busy ? t("common.processing") : !next ? tr("viewRewards") : !activity.active ? tr("closed") : next.claimable ? tr("claim") : t("explorer.unlockAt", { count: next.tier })}</button>
    </section>
    <nav className="explorer-secondary"><button onClick={() => setPanel("rewards")} type="button">{tr("viewRewards")}<span className="material-symbols-outlined">redeem</span></button><button onClick={() => setPanel("rules")} type="button">{t("activity.rules")}<span className="material-symbols-outlined">info</span></button></nav>
    <BottomSheet open={panel !== null} onClose={() => setPanel(null)} title={panel === "tasks" ? tr("viewTasks") : panel === "rewards" ? tr("viewRewards") : t("activity.rules")} bodyClassName="explorer-info">
      {panel === "tasks" ? <div className="explorer-task-list">{data.themes.map((theme) => <section key={theme.key}><header><span className="material-symbols-outlined">{themeIcons[theme.key]}</span><h3>{tr(`theme.${theme.key}`)}</h3>{theme.completed ? <span className="explorer-done">{tr("done")}</span> : null}</header>{theme.checks.map((check) => <button disabled={check.completed || !activity.active} key={check.key} onClick={() => task(check.key)} type="button"><span className="material-symbols-outlined">{check.completed ? "check_circle" : "radio_button_unchecked"}</span><span>{tr(`check.${check.key}`)}{check.key === "welcome" ? <small>{tr("welcomeLevel")}</small> : null}</span>{!check.completed ? <span className="material-symbols-outlined">chevron_right</span> : null}</button>)}</section>)}</div> : panel === "rewards" ? <div className="explorer-reward-gallery">{data.rewards.map((reward) => <article key={reward.tier} className={`explorer-reward-tile tier-${reward.tier}`}><div className="explorer-reward-preview">{reward.tier === 1 ? <UserAvatar className="explorer-avatar-preview" frame="explorer-conan" name={session?.user.name ?? "2026"} uri={session?.user.avatar_uri} /> : reward.tier === 2 ? <div className="explorer-bubble-preview"><span>{tr("previewLine")}</span><img alt="" src={`${assets}ai.webp`} /></div> : reward.tier === 3 ? <div className="explorer-duality-preview"><img alt="" src={`${assets}conan-night.webp`} /><img alt="" src={`${assets}shinichi-night.webp`} /></div> : <img alt="" src={`${assets}${rewardArt[reward.tier - 1]}`} />}</div><div><small>{t(`growth.rarity.${reward.rarity}` as TranslationKey)} · {tr(`type.${reward.resource_type}`)}</small><h3>{tr(`reward.${reward.tier}`)}</h3><p>{tr(`detail.${reward.tier}`)}</p><button className="explorer-text-action" onClick={() => reward.claimed ? configure(reward.tier) : setPanel("tasks")} type="button">{reward.claimed ? reward.tier === 5 ? tr("owned") : t("activity.configureReward") : t("explorer.unlockAt", { count: reward.tier })}<span className="material-symbols-outlined">{reward.claimed ? "check_circle" : "lock"}</span></button></div></article>)}</div> : <div className="explorer-rules"><p>{tr("dates")}</p><p>{tr("rule1")}</p><p>{tr("rule2")}</p><p>{tr("rule3")}</p><p>{tr("rule4")}</p></div>}
    </BottomSheet>
    {session ? <ChronellePluginDialog open={chronelleOpen} onClose={() => { setChronelleOpen(false); void refresh(); }} userId={session.user.user_id} onChange={() => void refresh()} /> : null}
  </div>;
}
