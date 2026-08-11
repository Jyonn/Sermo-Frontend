import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { api } from "./api";
import { useAuth } from "./auth";
import { useI18n } from "./language";
import type { FeatureDiscoveryDTO, FeatureDiscoveryStatusDTO } from "../types";

export const FEATURE_DISCOVERY_REFRESH_EVENT = "sermo:feature-discoveries-refresh";

interface FeatureGuideConfig {
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void | Promise<void>;
}

interface ActiveGuide extends FeatureGuideConfig {
  feature: FeatureDiscoveryDTO;
  target: HTMLElement;
}

interface FeatureDiscoveryContextValue {
  feature: (rewardId: string) => FeatureDiscoveryDTO | null;
  discover: (rewardId: string) => Promise<void>;
  openGuide: (feature: FeatureDiscoveryDTO, target: HTMLElement, guide: FeatureGuideConfig) => void;
}

const FeatureDiscoveryContext = createContext<FeatureDiscoveryContextValue | null>(null);

export function FeatureDiscoveryProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState<FeatureDiscoveryStatusDTO>({ features: [], pending_count: 0 });
  const [activeGuide, setActiveGuide] = useState<ActiveGuide | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const identity = session ? `${session.user.space_id}:${session.user.user_id}` : "";

  const refresh = useCallback(() => {
    if (!session) {
      setStatus({ features: [], pending_count: 0 });
      return;
    }
    void api.getFeatureDiscoveries().then(setStatus).catch(() => undefined);
  }, [identity]);

  useEffect(() => {
    refresh();
    window.addEventListener(FEATURE_DISCOVERY_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(FEATURE_DISCOVERY_REFRESH_EVENT, refresh);
  }, [refresh]);

  useEffect(() => {
    if (!activeGuide) return;
    const update = () => setTargetRect(activeGuide.target.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [activeGuide]);

  const discover = useCallback(async (rewardId: string) => {
    setStatus((current) => ({
      ...current,
      pending_count: Math.max(0, current.pending_count - (current.features.some((item) => item.reward_id === rewardId && item.is_new) ? 1 : 0)),
      features: current.features.map((item) => item.reward_id === rewardId ? { ...item, is_new: false } : item),
    }));
    try {
      setStatus(await api.discoverFeature(rewardId));
    } catch {
      refresh();
    }
  }, [refresh]);

  const features = useMemo(() => new Map(status.features.map((item) => [item.reward_id, item])), [status.features]);
  const value = useMemo<FeatureDiscoveryContextValue>(() => ({
    feature: (rewardId) => features.get(rewardId) ?? null,
    discover,
    openGuide: (feature, target, guide) => setActiveGuide({ feature, target, ...guide }),
  }), [discover, features]);

  const runGuideAction = async () => {
    if (!activeGuide) return;
    const guide = activeGuide;
    setActiveGuide(null);
    await discover(guide.feature.reward_id);
    await guide.onAction?.();
  };

  return (
    <FeatureDiscoveryContext.Provider value={value}>
      {children}
      {activeGuide && targetRect ? createPortal(
        <div className="feature-coachmark" role="presentation" onClick={() => setActiveGuide(null)}>
          <span
            className="feature-coachmark-spotlight"
            style={{
              "--feature-x": `${targetRect.left}px`,
              "--feature-y": `${targetRect.top}px`,
              "--feature-width": `${targetRect.width}px`,
              "--feature-height": `${targetRect.height}px`,
            } as CSSProperties}
          />
          <section
            aria-modal="true"
            className={`feature-coachmark-card${targetRect.bottom > window.innerHeight * 0.62 ? " is-above" : ""}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            style={{
              "--feature-center-x": `${Math.min(window.innerWidth - 24, Math.max(24, targetRect.left + targetRect.width / 2))}px`,
              "--feature-top": `${targetRect.top}px`,
              "--feature-bottom": `${targetRect.bottom}px`,
            } as CSSProperties}
          >
            <span className="feature-coachmark-kicker">{t("featureDiscovery.newFeature")}</span>
            <strong>{activeGuide.title}</strong>
            <p>{activeGuide.description}</p>
            <div>
              <button className="feature-coachmark-later" onClick={() => setActiveGuide(null)} type="button">{t("featureDiscovery.later")}</button>
              <button className="feature-coachmark-action" onClick={() => void runGuideAction()} type="button">{activeGuide.actionLabel}</button>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </FeatureDiscoveryContext.Provider>
  );
}

export function useFeatureDiscovery() {
  const context = useContext(FeatureDiscoveryContext);
  if (!context) throw new Error("useFeatureDiscovery must be used within FeatureDiscoveryProvider");
  return context;
}

export function FeatureDiscoveryTarget({
  children,
  className = "",
  guide,
  rewardId,
}: {
  children: ReactNode;
  className?: string;
  guide?: FeatureGuideConfig;
  rewardId: string;
}) {
  const { discover, feature, openGuide } = useFeatureDiscovery();
  const current = feature(rewardId);
  const isNew = Boolean(current?.is_new);

  const handleClickCapture = (event: MouseEvent<HTMLSpanElement>) => {
    if (!current || !isNew) return;
    if (!guide) {
      void discover(rewardId);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openGuide(current, event.currentTarget, guide);
  };

  return (
    <span className={`feature-discovery-target${isNew ? " is-new" : ""}${className ? ` ${className}` : ""}`} onClickCapture={handleClickCapture}>
      {children}
      {isNew ? <i className="feature-discovery-dot" aria-label={current?.title} /> : null}
    </span>
  );
}

export function FeatureDiscoveryMarker({ rewardId }: { rewardId: string }) {
  const { feature } = useFeatureDiscovery();
  const current = feature(rewardId);
  return current?.is_new ? <i className="feature-discovery-dot is-inline" aria-label={current.title} /> : null;
}
