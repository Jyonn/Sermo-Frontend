import {lazy,Suspense,useEffect,useRef,useState,type CSSProperties} from 'react';
import {useNavigate} from 'react-router-dom';
import {api} from '../lib/api';
import {useAuth} from '../lib/auth';
import {useSpaceFeatures} from '../lib/spaceFeatures';
import {activityDrawerClassName,activityThemeForKey} from '../lib/activityTheme';
import {useI18n} from '../lib/language';
import {isChineseLanguage,localeForLanguage} from '../lib/i18n';
import {showToast} from '../lib/toast';
import {getDetectedSpaceSlug,buildSpaceHrefForCurrentHost} from '../lib/spaceEntry';
import type {ActivityCampaignDTO,PermanentVipCampaignDTO,ChatDTO} from '../types';
import {SideDrawer} from './SideDrawer';
import {BottomSheet} from './BottomSheet';
import {ActivityTitle} from './ActivityCampaignCard';
import {ActivityDetails} from './ActivityDetails';
import {ActivityRewardRail} from './ActivityRewardRail';
import {ActivityLoadingState} from './ActivityLoadingState';
import {FeedbackState} from './FeedbackState';
import {ExplorerActivity} from './ExplorerActivity';
import {NumberDuelActivity} from './NumberDuelActivity';
import {BgmActivity} from './BgmActivity';
import {FriendlyNeighborhoodActivity} from './FriendlyNeighborhoodActivity';
import {StarryNightActivity} from './StarryNightActivity';
import {UserAvatar} from './UserAvatar';
import {ChatTargetPicker} from './ChatTargetPicker';
const ChatsPage=lazy(()=>import('../pages/ChatsPage'));
import './SquareActivities.css';
const tieguaiLi = "https://api.sermo.jyonn.space/resources/assets/92/display/7a3700a814de2c54cf8e004cccb5228c0de74646799a4a43a9ec9e9667ea06ee";
const zhongliQuan = "https://api.sermo.jyonn.space/resources/assets/94/display/13a0ae982455c37ba3ebac16d675cbaceb63597f0e84bf9171d4b0ecc802dd2c";
const zhangGuolao = "https://api.sermo.jyonn.space/resources/assets/93/display/c0d87f466e8ed1e88b992ac1022752a7f4ef276175ce8602aca7c9e983b22957";
const lvDongbin = "https://api.sermo.jyonn.space/resources/assets/91/display/682bf48f72db3d89bf7c3445a89b7df70456f71142184cfc061752732af86832";
const heXiangu = "https://api.sermo.jyonn.space/resources/assets/89/display/4f37ad487d6f3d2e7bbcc154ee6e92de0cf97c6130ab43cecf8ec4943d6162b5";
const lanCaihe = "https://api.sermo.jyonn.space/resources/assets/90/display/cdac99ad29c003d358052b56f4dfedb4c33a26213ed07c1dca87c55c6f5a849b";
const hanXiangzi = "https://api.sermo.jyonn.space/resources/assets/88/display/f1e04a067b88c2e1c2c208430b0e08adadc0a689d0b17604abf079bb6d8c3ee5";
const caoGuojiu = "https://api.sermo.jyonn.space/resources/assets/87/display/addffd5b42eceaaccab7b3b41235530970283d684794734dbd02ac0ee142c6ce";
const heXianguSealSheet = "https://api.sermo.jyonn.space/resources/assets/132/display/bc3b92821a129652dd9548f5cf2efea6b9942c2da1ab134a708d553d9ceeb157";
const lvDongbinSealSheet = "https://api.sermo.jyonn.space/resources/assets/133/display/3f1b56d3c98c3a9ab8dde1c65ce37c41fac86ba0bd5e727a778f3b8b3ee6af3e";
const zhongliQuanSealSheet = "https://api.sermo.jyonn.space/resources/assets/134/display/6c38f40ec84a374b7e75eba54c7b74951e89187fba78e46c9790e559aa37926e";

const BAXIAN_IMMORTALS = [
  ["铁拐李", "Tieguai Li", tieguaiLi], ["钟离权", "Zhongli Quan", zhongliQuan], // i18n-ignore: proper names
  ["张果老", "Zhang Guolao", zhangGuolao], ["吕洞宾", "Lu Dongbin", lvDongbin], // i18n-ignore: proper names
  ["何仙姑", "He Xiangu", heXiangu], ["蓝采和", "Lan Caihe", lanCaihe], // i18n-ignore: proper names
  ["韩湘子", "Han Xiangzi", hanXiangzi], ["曹国舅", "Cao Guojiu", caoGuojiu], // i18n-ignore: proper names
] as const;
const BAXIAN_PRIZE_BUBBLES = [
  { style: "baxian-lv", label: "menu.styleBaxianLv", dialogue: [
    { from: "other", key: "activity.previewLvOther1" }, { from: "other", key: "activity.previewLvOther2" },
    { from: "self", key: "activity.previewLvSelf1" }, { from: "self", key: "activity.previewLvSelf2" },
    { from: "other", key: "activity.previewLvOther3" }, { from: "other", key: "activity.previewLvOther4" },
    { from: "other", key: "activity.locationPenglai", kind: "location", latitude: 37.8112, longitude: 120.7574 },
    { from: "self", key: "activity.previewLvSelf3" },
  ] },
  { style: "baxian-zhongli", label: "menu.styleBaxianZhongli", dialogue: [
    { from: "other", key: "activity.previewZhongliOther1" }, { from: "other", key: "activity.previewZhongliOther2" }, { from: "other", key: "activity.previewZhongliOther3" },
    { from: "self", key: "activity.previewZhongliSelf1" }, { from: "self", key: "activity.previewZhongliSelf2" },
    { from: "self", key: "activity.locationZhongnan", kind: "location", latitude: 33.9514, longitude: 108.8017 },
    { from: "other", key: "activity.previewZhongliOther4" }, { from: "other", key: "activity.previewZhongliOther5" },
  ] },
  { style: "baxian-he", label: "menu.styleBaxianHe", dialogue: [
    { from: "other", key: "activity.previewHeOther1" }, { from: "other", key: "activity.previewHeOther2" },
    { from: "self", key: "activity.previewHeSelf1" }, { from: "self", key: "activity.previewHeSelf2" },
    { from: "other", key: "activity.locationHeaven", kind: "location", latitude: 30.259, longitude: 120.138 },
    { from: "other", key: "activity.previewHeOther3" }, { from: "other", key: "activity.previewHeOther4" },
    { from: "self", key: "activity.previewHeSelf3" }, { from: "self", key: "activity.previewHeSelf4" },
  ] },
] as const;
const BAXIAN_SEAL_SHEETS = [lvDongbinSealSheet, zhongliQuanSealSheet, heXianguSealSheet] as const;

function ActivityForceProgress({ total, target }: { total: number; target: number }) {
  const progress = target > 0 ? Math.min(1, total / target) : 0;
  return <div className="activity-force-progress" role="progressbar" aria-valuemax={target} aria-valuemin={0} aria-valuenow={Math.min(total, target)}>
    <div className="activity-force-track"><i style={{ transform: `scaleX(${progress})` }} /></div>
    {[8, 16].map((threshold) => <div className={`activity-force-milestone${total >= threshold ? " is-reached" : ""}`} key={threshold} style={{ left: `${Math.min(1, threshold / Math.max(1, target)) * 100}%` }}>
      <span className="activity-force-seal-cycle" aria-hidden="true">
        {BAXIAN_SEAL_SHEETS.map((sheet, index) => <i key={sheet} style={{ "--seal-image": `url(${sheet})`, animationDelay: `${index * 1.2}s` } as CSSProperties} />)}
      </span>
      <b>{threshold}</b>
    </div>)}
  </div>;
}

function formatActivityDateRange(startsAt: number, endsAt: number | null, language: string, ongoingLabel: string) {
  const locale = localeForLanguage(language);
  const formatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  if (endsAt === null) return `${formatter.format(new Date(startsAt * 1000))} · ${ongoingLabel}`;
  return `${formatter.format(new Date(startsAt * 1000))} - ${formatter.format(new Date(endsAt * 1000))}`;
}

export function ActivityExperience({activityKey,onClose}:{activityKey:string;onClose:()=>void}) {
  const {t,language}=useI18n();
  const {session,patchSessionUser}=useAuth();
  const features=useSpaceFeatures();
  const navigate=useNavigate();
  const [activeActivity,setActiveActivity]=useState<ActivityCampaignDTO|null>(null);
  const theme=activeActivity?.theme||activityThemeForKey(activityKey);
  const [vipCampaign,setVipCampaign]=useState<PermanentVipCampaignDTO|null>(null);
  const [loadError,setLoadError]=useState(false);
  const [retry,setRetry]=useState(0);
  const [vipClaiming,setVipClaiming]=useState(false);
  const [activityClaiming,setActivityClaiming]=useState(false);
  const [personalRewardClaiming,setPersonalRewardClaiming]=useState(false);
  const [spaceRewardClaiming,setSpaceRewardClaiming]=useState(false);
  const [milestoneRewardClaiming,setMilestoneRewardClaiming]=useState<string|null>(null);
  const [starryRewardClaiming,setStarryRewardClaiming]=useState(false);
  const [activityContributing,setActivityContributing]=useState(false);
  const [activityRulesOpen,setActivityRulesOpen]=useState(false);
  const [activityPoolOpen,setActivityPoolOpen]=useState(false);
  const [activityPoolSlide,setActivityPoolSlide]=useState(0);
  const activityPoolTrackRef=useRef<HTMLDivElement>(null);
  const [shareOpen,setShareOpen]=useState(false);
  const [shareChats,setShareChats]=useState<ChatDTO[]>([]);
  const [shareLoading,setShareLoading]=useState(false);
  const [sharingId,setSharingId]=useState<number|null>(null);
  const patchActivity=(activity:ActivityCampaignDTO)=>{setActiveActivity(activity);window.dispatchEvent(new CustomEvent('frienden:activity-updated'));};
  useEffect(()=>{
    const controller=new AbortController();
    setLoadError(false);
    if(activityKey==='permanent-vip-founding-100') {
      void api.getUserMe(controller.signal).then(me=>{if(!controller.signal.aborted){setVipCampaign(me.permanent_vip_campaign??null);if(!me.permanent_vip_campaign)setLoadError(true);}}).catch(()=>{if(!controller.signal.aborted)setLoadError(true);});
    } else {
      void api.getActivity(activityKey,controller.signal).then(activity=>{
        if(controller.signal.aborted)return;
        setActiveActivity(activity);
        if(activity.newly_claimed)void api.markActivitySeen(activityKey).then(updated=>{if(!controller.signal.aborted)patchActivity(updated);}).catch(()=>undefined);
      }).catch(()=>{if(!controller.signal.aborted)setLoadError(true);});
    }
    return()=>controller.abort();
  },[activityKey,retry]);
  const publish=()=>{
    if(features.squareEnabled&&features.squareFreePostEnabled)navigate('/app/square?compose=1');
    else if(features.submissionEnabled)navigate('/app/submissions/new');
    else showToast(t('explorer.featureUnavailable'),'info');
  };
  const openActivityShare=async(activity:ActivityCampaignDTO)=>{
    setActiveActivity(activity);setShareOpen(true);setShareLoading(true);
    try{setShareChats(await api.getChats());}catch(cause){showToast(cause instanceof Error?cause.message:t('square.shareLoadFailed'),'error');}finally{setShareLoading(false);}
  };
  const sendShare=async(ids:number[])=>{
    const id=ids[0];if(!id||!activeActivity||sharingId!==null)return;setSharingId(id);
    const path=`/app/square/activities/${activityKey}`;
    const slug=getDetectedSpaceSlug();
    const url=slug?buildSpaceHrefForCurrentHost(slug,path):new URL(path,window.location.origin).toString();
    try{await api.sendMessage(id,11,JSON.stringify({kind:'activity',activity_key:activityKey,title:isChineseLanguage(language)?activeActivity.title:activeActivity.title_en||activeActivity.title,url}),undefined,crypto.randomUUID());setShareOpen(false);showToast(t('square.sharedTo',{chat:shareChats.find(chat=>chat.chat_id===id)?.title||t('nav.chats')}));}catch(cause){showToast(cause instanceof Error?cause.message:t('square.shareFailed'),'error');}finally{setSharingId(null);}
  };
  const claimPermanentVip = async () => {
    if (!vipCampaign?.eligible || vipClaiming) return;
    setVipClaiming(true);
    try {
      const campaign = await api.claimPermanentVip();
      setVipCampaign(campaign);
      patchSessionUser({ is_permanent_vip: true });
      showToast(t("vip.claimed", { slot: campaign.slot }), "success");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("vip.claimFailed"), "error");
    } finally {
      setVipClaiming(false);
    }
  };

  const contributeActivity = async () => {
    if (!activeActivity?.available_points || activityContributing) return;
    setActivityContributing(true);
    try {
      const updated = await api.contributeActivity(activeActivity.key);
      patchActivity(updated);
      showToast(t("activity.contributed", { count: activeActivity.available_points }));
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("activity.contributeFailed"), "error");
    } finally {
      setActivityContributing(false);
    }
  };

  const claimActivityForce = async () => {
    if (!activeActivity?.claimable_points || activityClaiming) return;
    setActivityClaiming(true);
    try {
      const claimable = activeActivity.claimable_points;
      const updated = await api.claimActivityForce(activeActivity.key);
      patchActivity(updated);
      showToast(t("activity.claimed", { count: claimable }));
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("activity.claimFailed"), "error");
    } finally {
      setActivityClaiming(false);
    }
  };

  const claimPersonalActivityReward = async () => {
    if (!activeActivity?.personal_reward_claimable || personalRewardClaiming) return;
    setPersonalRewardClaiming(true);
    try {
      const updated = await api.claimActivityPersonalReward(activeActivity.key);
      patchActivity(updated);
      showToast(t("activity.personalRewardClaimed"), "success");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("activity.personalRewardClaimFailed"), "error");
    } finally {
      setPersonalRewardClaiming(false);
    }
  };

  const claimSpaceActivityReward = async () => {
    if (!activeActivity?.space_reward_claimable || spaceRewardClaiming) return;
    setSpaceRewardClaiming(true);
    try {
      const updated = await api.claimActivitySpaceReward(activeActivity.key);
      patchActivity(updated);
      showToast(t("activity.spaceRewardClaimed"), "success");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("activity.spaceRewardClaimFailed"), "error");
    } finally {
      setSpaceRewardClaiming(false);
    }
  };

  const claimMilestoneActivityReward = async (rewardKey: string) => {
    if (!activeActivity || milestoneRewardClaiming) return;
    setMilestoneRewardClaiming(rewardKey);
    try {
      const updated = await api.claimActivityMilestoneReward(activeActivity.key, rewardKey);
      patchActivity(updated);
      showToast(t("activity.friendly.unlocked"), "success");
      void api.getUserMe().then((me) => patchSessionUser(me)).catch(() => undefined);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("activity.personalRewardClaimFailed"), "error");
    } finally {
      setMilestoneRewardClaiming(null);
    }
  };

  const claimStarryNightReward = async () => {
    if (!activeActivity?.starry_night?.reward_claimable || starryRewardClaiming) return;
    setStarryRewardClaiming(true);
    try {
      const updated = await api.claimStarryNightReward(activeActivity.key);
      patchActivity(updated);
      showToast(t("activity.starry.rewardClaimed"), "success");
      void api.getUserMe().then((me) => patchSessionUser(me)).catch(() => undefined);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("activity.starry.rewardClaimFailed"), "error");
    } finally {
      setStarryRewardClaiming(false);
    }
  };

 return <>
      <SideDrawer
        className={activityDrawerClassName(activityKey,theme)}
        contentUnderToolbar
        headerAction={activeActivity ? <button aria-label={t("square.share")} className="activity-drawer-share" onClick={() => openActivityShare(activeActivity)} type="button"><span className="material-symbols-outlined">share</span></button> : null}
        historyMode="route"
        onClose={onClose}
        open={Boolean(activityKey) && activityKey !== 'permanent-vip-founding-100'}
        title={activeActivity ? (isChineseLanguage(language) ? activeActivity.title : activeActivity.title_en || activeActivity.title) : t("activity.title")}
      >
        {activeActivity?.theme === "explorer" ? <ExplorerActivity activity={activeActivity} onUpdate={patchActivity} onPublish={() => { if (features.squareFreePostEnabled) { publish(); } else if (features.submissionEnabled) navigate("/app/submissions/new"); else showToast(t("explorer.featureUnavailable"), "error"); }} /> : activeActivity?.theme === "number_duel" ? <NumberDuelActivity activity={activeActivity} /> : activeActivity?.theme === "bgm" ? <BgmActivity activity={activeActivity} onUpdate={patchActivity} onTask={(kind) => { if(kind === "publish") publish(); else if(features.squareEnabled) navigate("/app/square"); else showToast(t("explorer.featureUnavailable"),"info"); }} /> : activeActivity?.theme === "spider-man-4" ? <FriendlyNeighborhoodActivity activity={activeActivity} claiming={milestoneRewardClaiming} onClaim={(key) => void claimMilestoneActivityReward(key)} /> : activeActivity?.theme === "starry-night" ? <StarryNightActivity activity={activeActivity} claiming={starryRewardClaiming} onClaim={() => void claimStarryNightReward()} onConfigure={() => navigate("/app/menu?panel=personalization/chat-page&section=backgrounds")} /> : activeActivity && theme==='baxian' ? <div className="activity-detail">
          <div className="activity-body-wordmark"><ActivityTitle activity={activeActivity} title={activeActivity.title}/></div>
          <div className="activity-detail-masthead">
            <div className="activity-detail-index">
              <div><button onClick={() => setActivityRulesOpen(true)} type="button">{t("activity.rules")}</button><i aria-hidden="true" /><button onClick={() => setActivityPoolOpen(true)} type="button">{t("activity.prizePool")}</button></div>
              <time>{formatActivityDateRange(activeActivity.starts_at, activeActivity.ends_at, language, t("activity.noTimeLimit"))}</time>
            </div>
          </div>
          <section className="activity-detail-visual" />
          <section className="activity-awakening-stage">
            <section className={`activity-personal-quest${activeActivity.personal_reward || activeActivity.personal_reward_claimable ? " is-complete" : ""}`}>
              <div><small>{t("activity.personalQuest")}</small><strong>{activeActivity.personal_reward ? t("activity.personalRewardOwnedNamed", { name: t(BAXIAN_PRIZE_BUBBLES.find((item) => item.style === activeActivity.personal_reward?.resource_key)?.label ?? "menu.collectionBaxian") }) : activeActivity.personal_reward_claimable ? t("activity.personalComplete") : t("activity.personalPostTwice")}</strong>{!activeActivity.personal_reward && !activeActivity.personal_reward_claimable ? <span>{t("activity.personalProgress", { current: Math.min(activeActivity.personal_event_count, activeActivity.personal_event_target), target: activeActivity.personal_event_target })}</span> : null}</div>
              {activeActivity.personal_reward ? <div className="activity-personal-reward"><button onClick={() => navigate("/app/menu?panel=personalization/chat-page&section=bubbles")} type="button">{t("activity.configureReward")}<span className="material-symbols-outlined">arrow_forward</span></button></div> : activeActivity.personal_reward_claimable ? <button className="activity-personal-claim" disabled={personalRewardClaiming} onClick={() => void claimPersonalActivityReward()} type="button">{personalRewardClaiming ? t("common.processing") : t("activity.claimPersonalReward")}</button> : <div className="activity-personal-stamps">{Array.from({ length: activeActivity.personal_event_target }, (_, index) => <i className={index < activeActivity.personal_event_count ? "is-earned" : ""} key={index}><span className="material-symbols-outlined">edit</span></i>)}</div>}
            </section>
            <header><div><small>{t("activity.spaceForce")}</small><strong>{activeActivity.space_total}<span> / {activeActivity.target}</span></strong></div><div className="activity-force-actions">{activeActivity.claimable_points ? <button disabled={activityClaiming || !activeActivity.active} onClick={() => void claimActivityForce()} type="button">{activityClaiming ? t("common.loading") : `${t("activity.claimForce")} · ${activeActivity.claimable_points}`}</button> : null}<button disabled={!activeActivity.available_points || activityContributing || !activeActivity.active} onClick={() => void contributeActivity()} type="button">{activityContributing ? t("common.loading") : `${t("activity.contribute")} · ${activeActivity.available_points}`}</button></div></header>
            <ActivityForceProgress target={activeActivity.target} total={activeActivity.space_total} />
            <ActivityRewardRail label={t('activity.spaceReward')} onOpen={()=>setActivityPoolOpen(true)} items={activeActivity.milestones.map(item=>({key:item.reward_id,title:item.reward_label,step:String(item.threshold),reached:item.unlocked}))}/>
            {activeActivity.space_reward_claimable ? <section className="activity-space-reward-ready"><div><small>{t("activity.spaceReward")}</small><strong>{t("activity.spaceRewardReady", { force: activeActivity.space_reward_claimable.threshold })}</strong></div><button disabled={spaceRewardClaiming} onClick={() => void claimSpaceActivityReward()} type="button">{spaceRewardClaiming ? t("common.processing") : t("activity.claimSpaceReward")}</button></section> : null}
            <div className="activity-immortal-track">{BAXIAN_IMMORTALS.map(([zh, en, image], index) => { const firstAwakening = activeActivity.awakenings?.find((item) => item.step === index + 1); const secondAwakening = activeActivity.awakenings?.find((item) => item.step === index + 9); const awakener = secondAwakening?.user; return <article className={secondAwakening ? "is-unlocked" : firstAwakening ? "is-awakened" : ""} key={zh}><div className="activity-immortal-figure"><img alt="" src={image} /></div><strong>{isChineseLanguage(language) ? zh : en}</strong><div className="activity-awakener-node">{awakener ? <UserAvatar className="activity-awakener-avatar" name={awakener.name} uri={awakener.avatar_uri} /> : <span>{index + 1}</span>}</div></article>; })}</div>
            <p className="activity-awakening-hint">{!activeActivity.verified ? t("activity.verifyHint") : activeActivity.claimable_points ? t("activity.claimHint") : activeActivity.today_earned ? t("activity.todayEarned") : t("activity.publishHint")}</p>
          </section>
        </div> : activeActivity ? <section className="activity-generic-overview"><ActivityTitle activity={activeActivity} title={isChineseLanguage(language)?activeActivity.title:activeActivity.title_en||activeActivity.title}/><p>{isChineseLanguage(language)?activeActivity.summary:activeActivity.summary_en||activeActivity.summary}</p></section> : loadError ? <FeedbackState tone="error" title={t("square.activitiesLoadFailed")} action={<button className="secondary-button" onClick={()=>setRetry(value=>value+1)}>{t("common.retry")}</button>}/> : <ActivityLoadingState/>}
      </SideDrawer>
      <BottomSheet className="activity-info-sheet" bodyClassName="activity-rules-sheet" onClose={() => setActivityRulesOpen(false)} open={activityRulesOpen} title={t("activity.rules")}>
        <div className="activity-rule-list">
          <article><span>01</span><div><strong>{t("activity.ruleVerifiedTitle")}</strong><p>{t("activity.ruleVerifiedBody")}</p></div></article>
          <article><span>02</span><div><strong>{t("activity.rulePersonalTitle")}</strong><p>{t("activity.rulePersonalBody")}</p></div></article>
          <article><span>03</span><div><strong>{t("activity.ruleEarnTitle")}</strong><p>{t("activity.ruleEarnBody")}</p></div></article>
          <article><span>04</span><div><strong>{t("activity.ruleSharedTitle")}</strong><p>{t("activity.ruleSharedBody")}</p></div></article>
        </div>
      </BottomSheet>
      <BottomSheet className="activity-info-sheet" bodyClassName="activity-pool-sheet" onClose={() => setActivityPoolOpen(false)} open={activityPoolOpen} title={t("activity.prizePool")}>
        <div className="activity-prize-grid" onScroll={(event) => {
          const track = event.currentTarget;
          const slides = Array.from(track.children) as HTMLElement[];
          const nearest = slides.reduce((best, slide, index) => Math.abs(slide.offsetLeft - track.offsetLeft - track.scrollLeft) < Math.abs(slides[best].offsetLeft - track.offsetLeft - track.scrollLeft) ? index : best, 0);
          setActivityPoolSlide(nearest);
        }} ref={activityPoolTrackRef}>
          {BAXIAN_PRIZE_BUBBLES.map(({ style, label, dialogue }) => (
            <article key={style}>
              <Suspense fallback={<ActivityLoadingState compact/>}><ChatsPage preview={{
                avatarName: activeActivity?.official_user?.name ?? t("brand.user"),
                avatarUri: activeActivity?.official_user?.avatar_uri,
                backgroundTheme: "default",
                bubbleStyle: style,
                dialogue: dialogue.map((item) => ({ from: item.from, text: t(item.key), kind: "kind" in item ? item.kind : undefined, latitude: "latitude" in item ? item.latitude : undefined, longitude: "longitude" in item ? item.longitude : undefined })),
                selfOnly: true,
              }} /></Suspense>
              <strong>{t(label)}</strong>
            </article>
          ))}
        </div>
        <div aria-label={t("activity.prizePool")} className="activity-prize-pagination">
          {BAXIAN_PRIZE_BUBBLES.map(({ style }, index) => <button aria-current={activityPoolSlide === index ? "true" : undefined} aria-label={`${index + 1}`} className={activityPoolSlide === index ? "is-active" : ""} key={style} onClick={() => {
            const track = activityPoolTrackRef.current;
            const slide = track?.children[index] as HTMLElement | undefined;
            if (track && slide) track.scrollTo({ behavior: "smooth", left: slide.offsetLeft - track.offsetLeft });
          }} type="button" />)}
        </div>
      </BottomSheet>
      <SideDrawer historyMode="route" className={activityDrawerClassName(activityKey,theme)} contentUnderToolbar headerAction={<button aria-label={t('square.share')} className="activity-drawer-share" onClick={() => { void api.getActivity('permanent-vip-founding-100').then(openActivityShare).catch(cause=>showToast(cause instanceof Error?cause.message:t('square.shareLoadFailed'),'error')); }} type="button"><span className="material-symbols-outlined">share</span></button>} onClose={onClose} open={activityKey==='permanent-vip-founding-100'} title={t("vip.campaignTitle")}>
        {vipCampaign ? <div className={`vip-campaign-panel${vipCampaign.claimed_by_user ? " is-claimed" : ""}`}>
          <section className="vip-campaign-hero">
            <span>FOUNDING 100</span>
            <ActivityTitle activity={{key:'permanent-vip-founding-100',theme:'permanent-vip'}} title={t('vip.campaignTitle')}/>
            <small>{vipCampaign.claimed_by_user ? t("vip.claimedSlot", { slot: vipCampaign.slot ? String(vipCampaign.slot).padStart(3, "0") : "---" }) : t("vip.remaining", { count: vipCampaign.remaining })}</small>
          </section>
          <ActivityDetails overview={open=><ActivityRewardRail label={t('vip.privilegesTitle')} onOpen={open} items={[{key:'recall',title:t('vip.recallTitle'),step:'7D',reached:vipCampaign.claimed_by_user},{key:'growth',title:t('vip.growthTitle'),step:'+500',reached:vipCampaign.claimed_by_user},{key:'badge',title:t('vip.badgeTitle'),step:vipCampaign.slot?String(vipCampaign.slot).padStart(3,'0'):'VIP',reached:vipCampaign.claimed_by_user}]}/>} rules={<p>{t('vip.levelTiers')}</p>} rewards={<section className="vip-campaign-benefits">
            <header><span>{t("vip.privilegesEyebrow")}</span><strong>{t("vip.privilegesTitle")}</strong></header>
            <div className="vip-campaign-benefit-grid">
              <article className="is-featured"><b>7D</b><span><strong>{t("vip.recallTitle")}</strong><small>{t("vip.recallDescription")}</small></span></article>
              <article className="is-featured"><b>+500</b><span><strong>{t("vip.growthTitle")}</strong><small>{t("vip.growthDescription")}</small></span></article>
              <article><b>BUBBLE</b><span><strong>{t("vip.bubbleTitle")}</strong><small>{t("vip.bubbleDescription")}</small></span></article>
              <article><b>CARD</b><span><strong>{t("vip.cardTitle")}</strong><small>{t("vip.cardDescription")}</small></span></article>
              <article><b>GOLD</b><span><strong>{t("vip.squareTitle")}</strong><small>{t("vip.squareDescription")}</small></span></article>
              <article className="is-wide"><b>{vipCampaign.claimed_by_user && vipCampaign.slot ? String(vipCampaign.slot).padStart(3, "0") : "001"}</b><span><strong>{t("vip.badgeTitle")}</strong><small>{t("vip.badgeDescription")}</small></span></article>
            </div>
          </section>}/>
          {!vipCampaign.claimed_by_user ? <div className="vip-campaign-requirements">{[
            ["email", t("contact.verifyEmail"), vipCampaign.requirements.email],
            ["phone", t("contact.bindPhone"), vipCampaign.requirements.phone],
            ["level", t("vip.reachLevel", { level: vipCampaign.required_level }), vipCampaign.requirements.level],
          ].map(([key, label, complete]) => <button className={complete ? "is-complete" : ""} disabled={Boolean(complete)} key={String(key)} onClick={() => { onClose(); navigate("/app/menu"); }} type="button"><i>{complete ? "✓" : ""}</i><strong>{label}</strong><span>{complete ? t("common.completed") : t("vip.goComplete")}</span></button>)}</div> : <div className="vip-campaign-owned"><b>VIP</b><span>{t("vip.permanentOwned")}</span></div>}
          {!vipCampaign.claimed_by_user ? <button className="vip-campaign-claim" disabled={!vipCampaign.eligible || vipClaiming} onClick={() => void claimPermanentVip()} type="button">{vipClaiming ? t("vip.reserving") : vipCampaign.eligible ? t("vip.claim") : t("vip.completeRequirements")}</button> : null}
        </div> : loadError?<FeedbackState tone="error" title={t("square.activitiesLoadFailed")} action={<button className="secondary-button" onClick={()=>setRetry(value=>value+1)}>{t("common.retry")}</button>}/>:<ActivityLoadingState/>}
      </SideDrawer>

      <ChatTargetPicker open={shareOpen} title={t('square.shareToChat')} targets={shareChats.map(chat=>{const peer=chat.members.find(member=>member.user_id!==session?.user.user_id)||chat.members[0];return {id:chat.chat_id,title:chat.title||peer?.name||t('nav.chats'),preview:chat.last_message?.content||'',avatarUri:chat.group?undefined:peer?.avatar_uri,groupMembers:chat.group?chat.members.map(member=>({name:member.name,uri:member.avatar_uri})):undefined};})} loading={shareLoading} busy={sharingId!==null} busyTargetId={sharingId} emptyTitle={t('square.noChatsToShare')} onClose={()=>{if(sharingId===null)setShareOpen(false);}} onSubmit={sendShare}/>

 </>;
}
