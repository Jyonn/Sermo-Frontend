export function legacySubmissionDestination(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  const legacyPath = pathname.match(/^\/app\/square\/submissions\/([^/]+)\/?$/);
  if (!legacyPath && !(pathname === "/app/square" && params.get("workspace") === "submissions")) return null;
  const id = legacyPath?.[1] ?? params.get("submission");
  const detail = id && /^[1-9]\d*$/.test(id) ? `/${id}` : "";
  const view = params.get("view");
  return `/app/submissions${detail}${view === "author" || view === "reviewer" ? `?view=${view}` : ""}`;
}
