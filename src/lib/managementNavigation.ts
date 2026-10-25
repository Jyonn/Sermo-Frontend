export const spaceManagementSections = ["members", "operators", "square", "mutes", "activities", "official", "basics", "features", "levels", "verification", "access", "permissions"] as const;
export const platformManagementSections = ["overview", "spaces", "reviews", "oauth", "emails", "emailReview", "audit", "debug", "permissions", "security"] as const;
export type SpaceManagementSection = typeof spaceManagementSections[number];
export type PlatformManagementSection = typeof platformManagementSections[number];

export function managementSection<T extends string>(value: string | null, sections: readonly T[], fallback: T): T {
  const candidate = value === "menu" ? "basics" : value;
  return sections.find((section) => section === candidate) ?? fallback;
}

const settingsFields: Partial<Record<SpaceManagementSection, readonly string[]>> = {
  basics: ["name", "member_limit"],
  levels: ["level_names"],
  features: ["group_square_enabled", "chat_enabled", "space_group_enabled", "square_free_post_enabled", "submission_enabled", "square_explore_enabled", "qq_binding_enabled", "oauth_developer_enabled"],
  access: ["unverified_group_policy"],
};

// The API accepts a complete settings snapshot; save only this page's draft.
export function managementSettingsForSection<T extends object>(section: SpaceManagementSection, saved: T, draft: T): T {
  const result = { ...saved };
  for (const key of settingsFields[section] ?? []) {
    if (Object.prototype.hasOwnProperty.call(draft, key)) Object.assign(result, { [key]: Reflect.get(draft, key) });
  }
  return result;
}
