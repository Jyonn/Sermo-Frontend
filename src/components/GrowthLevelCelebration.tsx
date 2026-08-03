import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { UserGrowthDTO } from "../types";
import { useI18n, type TranslationKey } from "../lib/language";

const GROWTH_REFRESH_EVENT = "sermo:growth-refresh";
const GROWTH_POLL_INTERVAL = 30_000;

export function GrowthLevelCelebration() {
  const { t } = useI18n();
  const { session } = useAuth();
  const [growth, setGrowth] = useState<UserGrowthDTO | null>(null);
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
      void api.getGrowth()
        .then((nextGrowth) => {
          if (!cancelled) setGrowth(nextGrowth);
        })
        .catch(() => undefined)
        .finally(() => {
          requestInFlightRef.current = false;
        });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

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
  const pendingLevel = growth?.pending_level ?? (
    growth && acknowledgedLevel < growth.level ? acknowledgedLevel + 1 : null
  );
  const level = pendingLevel ? growth?.levels?.find((item) => item.level === pendingLevel) : null;

  useEffect(() => {
    if (!pendingLevel) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => actionRef.current?.focus(), 520);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
    };
  }, [pendingLevel]);

  if (!growth || !pendingLevel || !level) return null;

  const isLastPendingLevel = pendingLevel === growth.level;
  const unlocks = level.rewards?.length
    ? level.rewards.map((reward) => ({ id: reward.id, title: reward.title, rarity: reward.rarity }))
    : [{ id: "default", title: t("growth.defaultUnlock"), rarity: "common" }];

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
    <div
      aria-describedby="growth-celebration-unlocks"
      aria-labelledby="growth-celebration-title"
      aria-modal="true"
      className="growth-celebration"
      key={pendingLevel}
      role="dialog"
    >
      <div aria-hidden="true" className="growth-celebration-atmosphere">
        <i />
        <i />
        <i />
      </div>
      <div className="growth-celebration-stage">
        <header className="growth-celebration-eyebrow">
          <span>{t("growth.badge")}</span>
          <small>{String(pendingLevel).padStart(2, "0")} / {String(growth.level).padStart(2, "0")}</small>
        </header>

        <div className="growth-celebration-hero">
          <div aria-hidden="true" className="growth-celebration-level">
            <span>LV</span>
            <strong>{pendingLevel}</strong>
          </div>
          <div className="growth-celebration-heading">
            <p>{t("growth.newWave")}</p>
            <h2 id="growth-celebration-title">{level.name}</h2>
          </div>
        </div>

        <section className="growth-celebration-unlocks" id="growth-celebration-unlocks">
          <p>{t("growth.unlocked")}</p>
          <div>
            {unlocks.map((unlock, index) => (
              <span className={`is-${unlock.rarity}`} key={unlock.id} style={{ "--unlock-index": index } as CSSProperties}>
                <i aria-hidden="true" />
                <strong>{unlock.title}</strong>
                <em>{t(`growth.rarity.${unlock.rarity}` as TranslationKey)}</em>
              </span>
            ))}
          </div>
        </section>

        <footer className="growth-celebration-footer">
          {error ? <p role="alert">{error}</p> : null}
          <button disabled={acknowledging} onClick={() => void acknowledge()} ref={actionRef} type="button">
            <span>{acknowledging ? t("growth.confirming") : isLastPendingLevel ? t("growth.gotIt") : t("growth.continue")}</span>
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M5 12h13M13.5 6.5 19 12l-5.5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>
          <small>{t("growth.recordHint")}</small>
        </footer>
      </div>
    </div>
  );
}
