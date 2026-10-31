import { normalizeStableResourceUri, preferFreshResourceUri } from "./stableResource.ts";

const localMedia = new Map<string, string>();
const remoteMedia = new Map<string, string>();
const identity = (uri: string) => normalizeStableResourceUri(uri).replace(/([?&])variant=playback(?:&|$)/, "$1").replace(/[?&]$/, "");
export const sameMediaAsset = (left: string, right: string) => identity(left) === identity(right);

export function retainLocalMedia(remote: string, local: string) {
  if (!local.startsWith("blob:") || !/^https?:|^\//.test(remote)) return;
  const previous = remoteMedia.get(local);
  if (previous && normalizeStableResourceUri(previous) === normalizeStableResourceUri(remote)) remote = preferFreshResourceUri(previous, remote);
  localMedia.set(identity(remote), local);
  remoteMedia.set(local, remote);
}
export function releaseLocalMedia(local: string) {
  const remote = remoteMedia.get(local);
  if (remote && localMedia.get(identity(remote)) === local) localMedia.delete(identity(remote));
  remoteMedia.delete(local);
  URL.revokeObjectURL(local);
}
export function mediaSourceCandidates(uri: string) {
  const remote = remoteMedia.get(uri) ?? uri;
  const local = uri.startsWith("blob:") ? uri : localMedia.get(identity(uri));
  // A completed browser-compatible transcode takes precedence over the original file.
  const playback = /[?&]variant=playback(?:&|$)/.test(remote);
  return { primary: playback ? remote : local ?? remote, fallback: playback ? local : local ? remote : undefined };
}
export function freshMediaUri(uri: string, attempt: number, nonce: string) {
  if (!attempt || !/\/(?:messages\/blob|square\/media)\//.test(uri) || /^(blob:|data:)/.test(uri)) return uri;
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}sermo_retry=${encodeURIComponent(nonce)}-${attempt}`;
}
export function messageMediaAspect(width?: number | null, height?: number | null) {
  const ratio = Number(width) / Number(height);
  return Number(width) > 0 && Number(height) > 0 && Number.isFinite(ratio) ? Math.max(9 / 16, Math.min(16 / 9, ratio)) : 4 / 3;
}

export function readLocalMediaSize(uri: string, kind: "image" | "video"): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const node = kind === "image" ? new Image() : document.createElement("video");
    let done = false;
    const finish = (size: { width: number; height: number } | null) => {
      if (done) return;
      done = true; clearTimeout(timer);
      node.onload = null; node.onerror = null;
      if (node instanceof HTMLVideoElement) { node.onloadedmetadata = null; node.removeAttribute("src"); node.load(); }
      resolve(size);
    };
    const ready = () => {
      const width = node instanceof HTMLVideoElement ? node.videoWidth : node.naturalWidth;
      const height = node instanceof HTMLVideoElement ? node.videoHeight : node.naturalHeight;
      finish(width > 0 && height > 0 ? { width, height } : null);
    };
    const timer = window.setTimeout(() => finish(null), 3000);
    node.onerror = () => finish(null);
    if (node instanceof HTMLVideoElement) { node.preload = "metadata"; node.onloadedmetadata = ready; }
    else node.onload = ready;
    node.src = uri;
  });
}
