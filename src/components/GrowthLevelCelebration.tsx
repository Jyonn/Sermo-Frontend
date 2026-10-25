import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AvatarFrameStyle, ChatBackgroundTheme, ChatBubbleStyle, GrowthRewardDTO, PersonalizationDTO, UserGrowthDTO } from "../types";
import { useI18n, type TranslationKey } from "../lib/language";
import { showToast } from "../lib/toast";
import { growthStageForLevel } from "../lib/growth-stage";
import { GrowthRewardPreview } from "./GrowthRewardPreview";
import { usePageActive } from "../lib/pageActivity";
import { useModalFocus } from "../lib/modalFocus";
import "./FounderMedals.css";

const GROWTH_REFRESH_EVENT = "sermo:growth-refresh";
const GROWTH_POLL_INTERVAL = 30_000;

type CelebrationPage = "arrival" | "rewards" | "next";
function RewardVisual({ reward }: { reward: GrowthRewardDTO }) {
  const { session } = useAuth();
  return <GrowthRewardPreview reward={reward} name={session?.user.name} uri={session?.user.avatar_uri} />;
}

function RewardThumbnail({ reward }: { reward: GrowthRewardDTO }) {
  const { session } = useAuth();
  return <GrowthRewardPreview reward={reward} compact name={session?.user.name} uri={session?.user.avatar_uri} />;
}

function RewardCard({ reward, index, compact = false, spotlight = false, active = false, applying = false, onApply }: { reward: GrowthRewardDTO; index: number; compact?: boolean; spotlight?: boolean; active?: boolean; applying?: boolean; onApply?: () => void }) {
  const { t } = useI18n();
  const useCatalogPreview = compact;
  return (
    <article
      className={`growth-reveal-card category-${reward.category} rarity-${reward.rarity}${compact ? " is-compact" : ""}${spotlight ? " is-spotlight" : ""}${active ? " is-active-reward" : ""}`}
      style={{ "--reward-index": index } as CSSProperties}
    >
      <div className={`growth-reward-preview-shell${useCatalogPreview ? " is-catalog-preview" : ""}`}>
        <span className="growth-reward-rarity-label">{t(`growth.rarity.${reward.rarity}` as TranslationKey)}</span>
        {useCatalogPreview ? <RewardThumbnail reward={reward} /> : <RewardVisual reward={reward} />}
      </div>
      <div className="growth-reveal-card-copy">
        <span>{t(`growth.rewardCategory.${reward.category}` as TranslationKey)}</span>
        <strong>{reward.title}</strong>
      </div>
      <div className="growth-reward-tags">
        {reward.vip_access === "level_or_vip" ? <b>VIP · {t("growth.earlyAccess")}</b> : null}
      </div>
      {onApply ? (
        <button
          aria-label={applying ? t("growth.applyingReward") : t("growth.wearItNow")}
          className="growth-reward-apply-icon"
          disabled={applying}
          onClick={onApply}
          title={applying ? t("growth.applyingReward") : t("growth.wearItNow")}
          type="button"
        >
          {applying ? <span aria-hidden="true" /> : <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M8 4h8l1.5 4L21 9.5l-2 4-2.5-.7V20h-9v-7.2l-2.5.7-2-4L6.5 8z" /><path d="M9.5 4c.2 1.5 1 2.3 2.5 2.3S14.3 5.5 14.5 4" /></svg>}
        </button>
      ) : null}
      {reward.implementation_status === "planned" ? <small>{t("growth.planned")}</small> : null}
    </article>
  );
}

function RewardTrackItem({ active, onClick, reward }: { active: boolean; onClick: () => void; reward: GrowthRewardDTO }) {
  return (
    <button aria-pressed={active} className={`growth-earned-chip rarity-${reward.rarity}${active ? " is-active" : ""}`} onClick={onClick} type="button">
      <RewardThumbnail reward={reward} />
      <span><i aria-hidden="true">{active ? "▶" : "✓"}</i><strong>{reward.title}</strong></span>
    </button>
  );
}

export function GrowthLevelCelebration() {
  const pageActive = usePageActive();
  const { t } = useI18n();
  const { patchSessionUser, session } = useAuth();
  const [growth, setGrowth] = useState<UserGrowthDTO | null>(null);
  const [growthToken, setGrowthToken] = useState<string | undefined>(undefined);
  const [page, setPage] = useState<CelebrationPage>("arrival");
  const [rewardCursor, setRewardCursor] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);
  const [applyingReward, setApplyingReward] = useState(false);
  const [error, setError] = useState("");
  const requestInFlightRef = useRef(false);
  const refreshVersion = useRef(0);
  const founderRoot = useRef<HTMLDivElement>(null);
  const celebrationRoot = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement | null>(null);
  const rewardTrackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!session) {
      setGrowth(null);
      return;
    }
    if (!pageActive) return;
    let cancelled = false;
    const refresh = () => {
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;
      const version = refreshVersion.current;
      void api.getGrowth().then((nextGrowth) => {
        if (!cancelled && version === refreshVersion.current) { setGrowth(nextGrowth); setGrowthToken(session.accessToken); }
      }).catch(() => undefined).finally(() => {
        requestInFlightRef.current = false;
      });
    };
    refresh();
    const timer = window.setInterval(refresh, GROWTH_POLL_INTERVAL);
    window.addEventListener(GROWTH_REFRESH_EVENT, refresh);
    return () => {
      cancelled = true;
      requestInFlightRef.current = false;
      window.clearInterval(timer);
      window.removeEventListener(GROWTH_REFRESH_EVENT, refresh);
    };
  }, [pageActive, session?.accessToken]);

  const acknowledgedLevel = growth?.acknowledged_level ?? 0;
  const pendingFounderYear = growthToken === session?.accessToken ? growth?.pending_founder_medal_years?.[0] : undefined;
  useModalFocus(founderRoot, Boolean(pendingFounderYear), () => {});
  const pendingLevel = growth?.pending_level ?? (growth && acknowledgedLevel < growth.level ? acknowledgedLevel + 1 : null);
  const level = pendingLevel ? growth?.levels?.find((item) => item.level === pendingLevel) : null;
  const previousLevel = Math.max(0, (pendingLevel ?? 1) - 1);
  const previous = growth?.levels?.find((item) => item.level === previousLevel);
  const nextLevel = growth?.levels?.find((item) => item.level === (pendingLevel ?? 0) + 1);
  const stage = growthStageForLevel(pendingLevel ?? 1);
  useModalFocus(celebrationRoot, Boolean(growth && pendingLevel && level && !pendingFounderYear), () => {});

  useEffect(() => {
    setPage("arrival");
    setRewardCursor(0);
    setError("");
  }, [pendingLevel, pendingFounderYear]);


  useEffect(() => {
    if (page !== "rewards") return;
    const track = rewardTrackRef.current;
    const item = track?.querySelector<HTMLElement>(`[data-reward-index="${rewardCursor}"]`);
    if (!track || !item) return;
    if (window.matchMedia("(min-width: 900px), (min-width: 600px) and (max-height: 550px)").matches) {
      const targetTop = item.offsetTop - (track.clientHeight - item.offsetHeight) / 2;
      track.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    } else {
      const targetLeft = item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2;
      track.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    }
  }, [page, rewardCursor]);

  useEffect(() => {
    if (!pendingLevel && !pendingFounderYear) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => actionRef.current?.focus(), 500);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [pendingLevel, pendingFounderYear, page]);

  if (pendingFounderYear) return <div ref={founderRoot} tabIndex={-1} aria-labelledby="founder-ceremony-title" aria-modal="true" role="dialog" className="growth-celebration growth-ceremony stage-legendary founder-ceremony">
    <header className="growth-ceremony-topbar"><strong>FRIENDEN 友间</strong><span>{pendingFounderYear}</span></header>
    <main className="founder-ceremony-main">
      <div className="founder-ceremony-emblem" aria-hidden="true"><span className="material-symbols-outlined">workspace_premium</span></div>
      <small>{t("profile.founderHonored")}</small>
      <h1 id="founder-ceremony-title">{t("profile.founderMedal", { year: pendingFounderYear })}</h1>
      <p>{session?.user.name}</p><p>{t("profile.founderThanks")}</p>
    </main>
    <footer className="growth-ceremony-footer">{error ? <p role="alert">{error}</p> : null}<button ref={actionRef} type="button" disabled={acknowledging} onClick={() => {
      if (acknowledging) return;
      setAcknowledging(true); setError("");
      void api.acknowledgeFounderMedal(pendingFounderYear).then(next => { refreshVersion.current += 1; setGrowth(next); }).catch(() => setError(t("growth.confirmFailed"))).finally(() => setAcknowledging(false));
    }}>{t(acknowledging ? "growth.confirming" : "profile.founderAccept")}</button><small>{t("profile.founderSaved")}</small></footer>
  </div>;

  if (!growth || !pendingLevel || !level) return null;

  const currentReward = level.rewards[rewardCursor];
  const currentRewardIsSpotlight = currentReward?.rarity === "epic" || currentReward?.rarity === "legendary";

  const acknowledge = async () => {
    if (acknowledging) return;
    setAcknowledging(true);
    setError("");
    try {
      setGrowth(await api.acknowledgeGrowthLevel(pendingLevel));
    } catch {
      setError(t("growth.confirmFailed"));
    } finally {
      setAcknowledging(false);
    }
  };

  const canApplyReward = currentReward?.implementation_status !== "planned" && ["background", "bubble", "frame"].includes(currentReward?.category ?? "");

  const applyCurrentReward = async () => {
    if (!currentReward?.asset_key || !canApplyReward || applyingReward || !session) return;
    setApplyingReward(true);
    try {
      if (currentReward.category === "background") {
        const me = await api.setChatBackground(currentReward.asset_key as ChatBackgroundTheme);
        patchSessionUser(me);
      } else {
        const payload: PersonalizationDTO = {
          chat_bubble_style: currentReward.category === "bubble" ? currentReward.asset_key as ChatBubbleStyle : session.user.chat_bubble_style ?? "default",
          avatar_frame_style: currentReward.category === "frame" ? currentReward.asset_key as AvatarFrameStyle : session.user.avatar_frame_style ?? "none",
          show_self_avatar: Boolean(session.user.show_self_avatar),
        };
        patchSessionUser(await api.setPersonalization(payload));
      }
      showToast(t("growth.appliedReward", { reward: currentReward.title }));
    } catch {
      showToast(t("growth.applyRewardFailed"), "error");
    } finally {
      setApplyingReward(false);
    }
  };

  return (
    <div ref={celebrationRoot} tabIndex={-1} aria-labelledby="growth-celebration-title" aria-modal="true" className={`growth-celebration growth-ceremony growth-renewed stage-${stage} page-${page}`} role="dialog">
      <div aria-hidden="true" className="growth-ceremony-atmosphere"><i /><i /><i /></div>
      <header className="growth-ceremony-topbar">
        <strong>{t("growth.badge")}</strong>
        <span>{page === "arrival" ? "01" : page === "rewards" ? "02" : "03"} / 03</span>
      </header>

      {page === "arrival" ? (
        <main className="growth-arrival-page">
          <div className="growth-arrival-level" id="growth-celebration-title">
            <small>LEVEL UP</small>
            <div className="growth-level-flip">
              <span>{String(previousLevel).padStart(2, "0")}</span>
              <strong>{String(pendingLevel).padStart(2, "0")}</strong>
            </div>
            <p>{level.name}</p>
          </div>
          <div className="growth-arrival-progress">
            <div><span>{previous?.score ?? 0}</span><strong>{level.score}</strong></div>
            <div className="growth-arrival-track"><i /></div>
            <p>{t("growth.arrivalProgress", { level: pendingLevel })}</p>
          </div>
        </main>
      ) : null}

      {page === "rewards" ? (
        <main className="growth-rewards-page">
          <div className="growth-ceremony-heading">
            <span>LEVEL {String(pendingLevel).padStart(2, "0")}</span>
            <h2 id="growth-celebration-title">{t("growth.rewardsReceived")}</h2>
            <p>{t("growth.rewardCarousel", { current: rewardCursor + 1, count: level.rewards.length })}</p>
          </div>
          <div className={`growth-reward-theater${currentRewardIsSpotlight ? " is-spotlight" : ""}`}>
            <RewardCard active applying={applyingReward} index={rewardCursor} key={`${currentReward.id}-${rewardCursor}`} onApply={canApplyReward ? () => void applyCurrentReward() : undefined} reward={currentReward} spotlight={currentRewardIsSpotlight} />
            <div className="growth-earned-strip">
              <small>{t("growth.rewardGallery")}</small>
              <div ref={rewardTrackRef}>{level.rewards.map((reward, index) => <span data-reward-index={index} key={reward.id}><RewardTrackItem active={index === rewardCursor} onClick={() => setRewardCursor(index)} reward={reward} /></span>)}</div>
            </div>
          </div>
        </main>
      ) : null}

      {page === "next" ? (
        <main className="growth-next-page">
          <div className="growth-ceremony-heading">
            <span>{nextLevel ? `NEXT · LEVEL ${String(nextLevel.level).padStart(2, "0")}` : "LEVEL 18"}</span>
            <h2 id="growth-celebration-title">{nextLevel ? t("growth.nextLevelPreview") : t("growth.maxLevelReached")}</h2>
            <p>{nextLevel ? t("growth.nextLevelScore", { score: nextLevel.score }) : t("growth.maxLevelHint")}</p>
          </div>
          {nextLevel ? (
            <div className="growth-next-rewards">
              {nextLevel.rewards.map((reward, index) => <RewardCard compact index={index} key={reward.id} reward={reward} />)}
            </div>
          ) : <div className="growth-final-mark"><span>18</span><strong>{level.name}</strong></div>}
        </main>
      ) : null}

      <footer className="growth-ceremony-footer">
        {error ? <p role="alert">{error}</p> : null}
        <button
          disabled={acknowledging}
          onClick={() => page === "arrival" ? setPage("rewards") : page === "rewards" ? setPage("next") : void acknowledge()}
          ref={actionRef}
          type="button"
        >
          <span>{page === "arrival" ? t("growth.viewRewards") : page === "rewards" ? t("growth.viewNextLevel") : acknowledging ? t("growth.confirming") : t("growth.gotIt")}</span>
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M5 12h13M13.5 6.5 19 12l-5.5 5.5" /></svg>
        </button>
        <small>{page === "next" ? t("growth.recordHint") : t("growth.threeStepHint")}</small>
      </footer>
    </div>
  );
}
