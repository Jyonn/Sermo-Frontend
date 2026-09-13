const ASSET_ORIGINS = ["https://sermo.jyonn.space", "https://sermo.6-79.cn"];

function assetUrl(origin: string, path: string) {
  return `${origin}/${path.replace(/^\/+/, "")}`;
}

export async function fetchRemoteAsset(path: string) {
  let lastError: unknown;
  for (const origin of ASSET_ORIGINS) {
    try {
      const response = await fetch(assetUrl(origin, path), { cache: "force-cache", credentials: "omit", mode: "cors" });
      if (response.ok) return response;
      lastError = new Error(`Asset request failed (${response.status})`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Asset request failed");
}

export async function fetchRemoteJson<T>(path: string): Promise<T> {
  return (await fetchRemoteAsset(path)).json() as Promise<T>;
}
