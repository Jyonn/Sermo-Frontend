export const spaceManagementSections = ["members", "admission", "operators", "square", "mutes", "activities", "official", "basics", "levels", "verification", "permissions"] as const;
export const platformManagementSections = ["overview", "spaces", "reviews", "resources", "oauth", "emails", "emailReview", "audit", "debug", "permissions", "security"] as const;
export type SpaceManagementSection = typeof spaceManagementSections[number];
export type PlatformManagementSection = typeof platformManagementSections[number];

export function managementSection<T extends string>(value: string | null, sections: readonly T[], fallback: T): T {
  const candidate = value === "menu" ? "basics" :
    (value === "access" || value === "features") && sections.some((section) => section === "basics") ? "permissions" : value;
  return sections.find((section) => section === candidate) ?? fallback;
}

type SpaceSettingsSection = SpaceManagementSection | "features";
const settingsFields: Partial<Record<SpaceSettingsSection, readonly string[]>> = {
  basics: ["name", "member_limit", "qixi_theme_enabled", "christmas_theme_enabled"],
  levels: ["level_names"],
  features: ["group_square_enabled", "chat_enabled", "space_group_enabled", "square_free_post_enabled", "submission_enabled", "research_enabled", "annual_recap_enabled", "square_explore_enabled", "qq_binding_enabled", "oauth_developer_enabled"],
};

// The API accepts a complete settings snapshot; save only this page's draft.
export function managementSettingsForSection<T extends object>(section: SpaceSettingsSection, saved: T, draft: T): T {
  const result = { ...saved };
  for (const key of settingsFields[section] ?? []) {
    if (Object.prototype.hasOwnProperty.call(draft, key)) Object.assign(result, { [key]: Reflect.get(draft, key) });
  }
  return result;
}
