export type OAuthClientMetadata = { id: string; name: string; description: string; icon_url?: string; callback: string; scopes: string[]; parameters?: Record<string, string>; target_space?: { id: number; slug: string; name: string } | null; purpose?: "join" | "space_admin" };
export type OAuthRevision = { id: number; name: string; description: string; icon_url?: string; redirect_uris: string[]; scopes: string[]; loopback_uris: string[]; status: "draft" | "pending" | "approved" | "rejected"; review_note: string; reviewed_by: string; reviewed_at: string | null };
export type OAuthApplication = { id: number; client_id: string; owner_id: number | null; enabled: boolean; version: number; approved_revision_id: number | null; revisions: OAuthRevision[]; audit: { actor: string; action: string; version: number; created_at: string }[] };

export function validOAuthReturn(uri: string, callback: string, state: string) {
  const actual = new URL(uri);
  const expected = new URL(callback);
  const codes = actual.searchParams.getAll("code");
  if (codes.length !== 1 || !codes[0] || actual.searchParams.getAll("state").length !== 1 || actual.searchParams.get("state") !== state || actual.hash) return false;
  expected.searchParams.append("code", codes[0]);
  expected.searchParams.append("state", state);
  return actual.href === expected.href;
}
