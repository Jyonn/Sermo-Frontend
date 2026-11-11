import type { PlatformAdminSpaceDTO } from "../types";

export const spaceFeatureGrants = [
  { key: "christmas_theme", granted: "christmas_theme_granted", enabled: "christmas_theme_enabled", title: "admin.christmasTheme", description: "admin.spaceThemeHint", icon: "park" },
  { key: "annual_recap", granted: "annual_recap_granted", enabled: "annual_recap_enabled", title: "recap.title", description: "recap.adminHint", icon: "mail" },
  { key: "qixi_theme", granted: "qixi_theme_granted", enabled: "qixi_theme_enabled", title: "admin.qixiTheme", description: "admin.spaceThemeHint", icon: "palette" },
  { key: "oauth_developer", granted: "oauth_developer_granted", enabled: "oauth_developer_enabled", title: "management.devCapability", description: "management.devCapabilityHint", icon: "code" },
  { key: "qq_identity_binding", granted: "qq_binding_granted", enabled: "qq_binding_enabled", title: "admin.qqBindingFeature", description: "admin.qqBindingFeatureHint", icon: "link" },
] as const;
export type SpaceFeatureKey = typeof spaceFeatureGrants[number]["key"];

export function spaceFeatureGrantState(space: PlatformAdminSpaceDTO, feature: typeof spaceFeatureGrants[number]) {
  if (space[feature.granted] !== true) return "management.featureNotGranted";
  return space[feature.enabled] === true ? "management.featureEnabled" : "management.featurePending";
}
