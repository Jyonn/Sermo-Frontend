import { useI18n } from "../lib/language";
import { spaceFeatureGrants, spaceFeatureGrantState, type SpaceFeatureKey } from "../lib/spaceFeatureGrants";
import type { PlatformAdminSpaceDTO } from "../types";

export function PlatformSpaceFeatures({ space, busy, onToggle }: { space: PlatformAdminSpaceDTO; busy: SpaceFeatureKey | null; onToggle: (key: SpaceFeatureKey, granted: boolean) => void }) {
  const { t } = useI18n();
  return <section className="platform-space-capabilities"><h3>{t("management.spaceCapabilities")}</h3><p>{t("management.spaceCapabilitiesHint")}</p><div>{spaceFeatureGrants.map((feature) => <article key={feature.key}>
    <span aria-hidden="true" className="material-symbols-outlined">{feature.icon}</span><div><strong>{t(feature.title)}</strong><small>{t(spaceFeatureGrantState(space, feature))}</small></div>
    <button className={space[feature.granted] ? "is-revoke" : ""} aria-label={`${t(space[feature.granted] ? "management.revokeFeature" : "management.grantFeature")} ${t(feature.title)}`} disabled={busy !== null} onClick={() => onToggle(feature.key, !space[feature.granted])} type="button">{t(busy === feature.key ? "common.processing" : space[feature.granted] ? "management.revokeFeature" : "management.grantFeature")}</button>
  </article>)}</div></section>;
}
