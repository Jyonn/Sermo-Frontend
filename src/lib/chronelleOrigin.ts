export function chronelleOrigin(hostname = typeof window === "undefined" ? "" : window.location.hostname) {
  return hostname === "sermo.6-79.cn" || hostname === "frienden.6-79.cn"
    ? "https://chronelle.6-79.cn" : "https://chronelle.jyonn.space";
}
