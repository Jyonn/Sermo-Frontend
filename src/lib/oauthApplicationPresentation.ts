import type { OAuthApplication } from "./oauthClients";

export type OAuthApplicationFilter = "all" | "pending" | "enabled" | "disabled";
export const currentOAuthRevision = (app: OAuthApplication) => app.revisions.find((revision) => revision.id === app.approved_revision_id);
export const pendingOAuthRevision = (app: OAuthApplication) => app.revisions.find((revision) => revision.status === "pending");
export const oauthApplicationName = (app: OAuthApplication) => (currentOAuthRevision(app) ?? app.revisions[0])?.name || app.client_id;
export function oauthApplicationStatus(app: OAuthApplication) {
  if (!app.enabled) return "disabled";
  if (pendingOAuthRevision(app)) return "pending";
  if (currentOAuthRevision(app)) return "enabled";
  return app.revisions[0]?.status || "draft";
}
export function filterOAuthApplications(apps: OAuthApplication[], filter: OAuthApplicationFilter, query: string) {
  const search = query.trim().toLocaleLowerCase();
  return apps.filter((app) => {
    const matches = filter === "all" || filter === "pending" && Boolean(pendingOAuthRevision(app)) || filter === "enabled" && app.enabled && Boolean(currentOAuthRevision(app)) || filter === "disabled" && !app.enabled;
    return matches && (!search || `${app.client_id} ${app.revisions.map((revision) => revision.name).join(" ")}`.toLocaleLowerCase().includes(search));
  });
}
