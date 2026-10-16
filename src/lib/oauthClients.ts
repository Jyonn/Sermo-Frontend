export function oauthClient(clientId: string | null, stillfolioCallback: string) {
  if (clientId === "stillfolio") return { id: clientId, nameKey: "apps.stillfolio" as const, label: "STILLFOLIO", callback: stillfolioCallback, scopes: ["profile", "phone", "vip"] };
  if (clientId === "chronelle") return { id: clientId, nameKey: "chronelle.title" as const, label: "CHRONELLE", callback: "https://chronelle.jyonn.space/api/profile/sermo/callback/", scopes: ["profile"] };
  return null;
}
