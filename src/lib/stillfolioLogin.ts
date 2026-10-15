export const STILLFOLIO_LOGIN_ENTRY = "https://stillfolio.jyonn.space/auth/sermo/start";

export function parseSermoLoginHint(value: string | null) {
  const match = /^([a-z0-9][a-z0-9_-]{0,63}):([1-9]\d*)$/.exec(value || "");
  if (!match) return null;
  const userId = Number(match[2]);
  return Number.isSafeInteger(userId) ? { slug: match[1], userId } : null;
}

export function buildStillfolioLoginUrl(slug: string, userId?: number) {
  const url = new URL(STILLFOLIO_LOGIN_ENTRY);
  url.searchParams.set("source", "sermo");
  const hint = `${slug.trim().toLowerCase()}:${userId}`;
  if (parseSermoLoginHint(hint)) url.searchParams.set("login_hint", hint);
  return url.href;
}
