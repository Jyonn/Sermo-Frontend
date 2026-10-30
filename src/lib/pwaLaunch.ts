export function pwaLaunchAccount<T extends { key: string }>(accounts: T[], search: string, lastAccountKey: string, oauthPending: boolean): T | undefined {
  const params = new URLSearchParams(search);
  if (params.get("source") !== "pwa" || params.get("choose") === "1" || params.get("oauth_login") === "1" || oauthPending) return undefined;
  return accounts.find((account) => account.key === lastAccountKey);
}
