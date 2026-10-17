export function oauthClient(clientId: string | null, stillfolioCallback: string) {
  if (clientId === "stillfolio") return { id: clientId, nameKey: "apps.stillfolio" as const, label: "STILLFOLIO", callback: stillfolioCallback, scopes: ["profile", "phone", "vip"] };
  if (clientId === "chronelle") return { id: clientId, nameKey: "chronelle.title" as const, label: "CHRONELLE", callback: "https://chronelle.jyonn.space/api/profile/sermo/callback/", scopes: ["profile"] };
  if (clientId === "supervision-local") return { id: clientId, nameKey: "apps.supervision" as const, label: "SUPERVISION", callback: "http://127.0.0.1:8001/api/auth/friendom/callback/", scopes: ["profile"] };
  return null;
}
