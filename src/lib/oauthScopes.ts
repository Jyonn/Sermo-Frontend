export const oauthDomains = ["chat", "square", "submission", "contacts", "personal"] as const;
export type OAuthDomain = typeof oauthDomains[number];
export type OAuthScopeCatalogEntry = { scope: string; domain: OAuthDomain; action: "read" | "write" | "modify"; status: "legacy" | "implemented" | "planned" | "unsupported"; available: boolean };
export type OAuthPermissionGroup = { key: OAuthDomain; scopes: string[] };
const legacyScopes = ["profile", "email", "phone", "vip"];
const describedScopes = [...legacyScopes, ...oauthDomains.flatMap(domain => ["read", "write", "modify"].map(action => `${domain}.${action}`)).filter(scope => scope !== "square.modify" && scope !== "personal.write")];
export const legacyScopeCatalog: OAuthScopeCatalogEntry[] = legacyScopes.map(scope => ({ scope, domain: "personal", action: "read", status: "legacy", available: true }));

// A deployment without the new metadata can describe only legacy identity scopes.
// Never approve an unrendered permission or use the URL as the permission source.
export function consentPermissionGroups(scopes: string[], groups?: OAuthPermissionGroup[]): OAuthPermissionGroup[] | null {
  if (!scopes.length || scopes.some(scope => !describedScopes.includes(scope))) return null;
  if (!groups) return scopes.every(scope => legacyScopes.includes(scope)) ? [{ key: "personal", scopes }] : null;
  const rendered = groups.flatMap(group => group.scopes);
  if (new Set(rendered).size !== rendered.length || rendered.length !== scopes.length || scopes.some(scope => !rendered.includes(scope))) return null;
  if (groups.some(group => !oauthDomains.includes(group.key) || !group.scopes.length || group.scopes.some(scope => (legacyScopes.includes(scope) ? "personal" : scope.split(".")[0]) !== group.key))) return null;
  return groups;
}

export function updateOAuthScopes(current: string[], scope: string, enabled: boolean, catalog: OAuthScopeCatalogEntry[] = legacyScopeCatalog) {
  const next = new Set(current);
  if (enabled) {
    if (!catalog.some(entry => entry.scope === scope && entry.available)) return current;
    next.add(scope);
  } else {
    next.delete(scope);
  }
  return [...next];
}
