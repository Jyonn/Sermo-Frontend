export type OAuthVerificationChannel = "email" | "phone";
export type OAuthEligibility = { eligible: boolean; missing_verifications: OAuthVerificationChannel[]; verification_path: string };

export function oauthVerificationTarget(channel: OAuthVerificationChannel, search: string) {
  return {
    to: `/app/menu?sheet=${channel === "email" ? "email" : "phone"}-verification&oauth=1`,
    state: { oauthReturnTo: `/oauth/authorize${search}` },
  };
}

export function safeOAuthVerificationReturn(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/oauth/authorize?")) return null;
  try {
    const url = new URL(value, "https://frienden.invalid");
    return url.origin === "https://frienden.invalid" && url.pathname === "/oauth/authorize" && !url.hash ? value : null;
  } catch { return null; }
}

export function oauthVerificationReturn(state: unknown, search: string, pending: string | null) {
  if (new URLSearchParams(search).get("oauth") !== "1") return null;
  const candidate = state && typeof state === "object" ? (state as { oauthReturnTo?: unknown }).oauthReturnTo : null;
  return safeOAuthVerificationReturn(candidate) || safeOAuthVerificationReturn(pending);
}

export function oauthIconUrl(value?: string) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password && !url.hash ? url.href : null;
  } catch { return null; }
}
