import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { GrowthRewardDTO, UserGrowthDTO } from "../types";
import { useI18n, type TranslationKey } from "../lib/language";

const GROWTH_REFRESH_EVENT = "sermo:growth-refresh";
const GROWTH_POLL_INTERVAL = 30_000;

type CelebrationPage = "arrival" | "rewards" | "next";
type GrowthStage = "common" | "uncommon" | "rare" | "epic" | "legendary";

function stageForLevel(level: number): GrowthStage {
  if (level <= 3) return "common";
  if (level <= 6) return "uncommon";
  if (level <= 10) return "rare";
  if (level <= 14) return "epic";
  return "legendary";
}

function RewardIcon({ category }: { category: GrowthRewardDTO["category"] }) {
  const paths: Record<GrowthRewardDTO["category"], ReactNode> = {
    capability: <><path d="M7 12.5 10.2 16 17 8.5" /><path d="M12 2.8 14.4 6l4-.1-1.1 3.8 2.5 3.1-3.4 2.1.2 4-3.9-.8-2.1 3.3-2.8-2.8-3.8.7-.5-3.9-3.6-1.8 2.2-3.3L1.2 7.7l3.9-1.4L7.2 3z" /></>,
    background: <><rect height="15" rx="2" width="18" x="3" y="4.5" /><path d="m5.5 16 4.2-4.5 3.1 3 2.4-2.2 3.3 3.7M8 9h.01" /></>,
    bubble: <path d="M4 5.5h16v11H9l-4.5 3v-3H4z" />,
    frame: <><rect height="15" rx="4" width="15" x="4.5" y="4.5" /><circle cx="12" cy="10" r="2.2" /><path d="m7.2 17 3.1-3.4 2.2 2.1 1.7-1.5 2.6 2.8" /></>,
    identity: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5.5 20c.7-4.2 3-6.3 6.5-6.3s5.8 2.1 6.5 6.3" /><path d="m18.5 4 .6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" /></>,
  };
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">{paths[category]}</svg>;
}

function RewardCard({ reward, index, compact = false }: { reward: GrowthRewardDTO; index: number; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <article
      className={`growth-reveal-card category-${reward.category} rarity-${reward.rarity}${compact ? " is-compact" : ""}`}
      style={{ "--reward-index": index } as CSSProperties}
    >
      <div className="growth-reveal-card-icon"><RewardIcon category={reward.category} /></div>
      <div className="growth-reveal-card-copy">
        <span>{t(`growth.rewardCategory.${reward.category}` as TranslationKey)}</span>
        <strong>{reward.title}</strong>
      </div>
      <em>{t(`growth.rarity.${reward.rarity}` as TranslationKey)}</em>
      {reward.implementation_status === "planned" ? <small>{t("growth.planned")}</small> : null}
    </article>
  );
}

export function GrowthLevelCelebration() {
  const { t } = useI18n();
  const { session } = useAuth();
  const [growth, setGrowth] = useState<UserGrowthDTO | null>(null);
  const [page, setPage] = useState<CelebrationPage>("arrival");
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState("");
  const requestInFlightRef = useRef(false);
  const actionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!session) {
      setGrowth(null);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;
      void api.getGrowth().then((nextGrowth) => {
        if (!cancelled) setGrowth(nextGrowth);
      }).catch(() => undefined).finally(() => {
        requestInFlightRef.current = false;
      });
    };
    const handleVisibility = () => document.visibilityState === "visible" && refresh();
    refresh();
    const timer = window.setInterval(refresh, GROWTH_POLL_INTERVAL);
    window.addEventListener(GROWTH_REFRESH_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      requestInFlightRef.current = false;
      window.clearInterval(timer);
      window.removeEventListener(GROWTH_REFRESH_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session?.accessToken]);

  const acknowledgedLevel = growth?.acknowledged_level ?? 0;
  const pendingLevel = growth?.pending_level ?? (growth && acknowledgedLevel < growth.level ? acknowledgedLevel + 1 : null);
  const level = pendingLevel ? growth?.levels?.find((item) => item.level === pendingLevel) : null;
  const previousLevel = Math.max(0, (pendingLevel ?? 1) - 1);
  const previous = growth?.levels?.find((item) => item.level === previousLevel);
  const nextLevel = growth?.levels?.find((item) => item.level === (pendingLevel ?? 0) + 1);
  const stage = stageForLevel(pendingLevel ?? 1);

  useEffect(() => {
    setPage("arrival");
    setError("");
  }, [pendingLevel]);

  useEffect(() => {
    if (!pendingLevel) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => actionRef.current?.focus(), 500);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [pendingLevel, page]);

  if (!growth || !pendingLevel || !level) return null;

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

  return (
    <div aria-labelledby="growth-celebration-title" aria-modal="true" className={`growth-celebration growth-ceremony stage-${stage} page-${page}`} role="dialog">
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
            <p>{t("growth.rewardsReceivedHint", { count: level.rewards.length })}</p>
          </div>
          <div className="growth-reveal-grid">
            {level.rewards.map((reward, index) => <RewardCard index={index} key={reward.id} reward={reward} />)}
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
