import { ApiError, api } from "./api";
import { i18n } from "./language";
import type { MessageMediaKind } from "../types";

const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const VIDEO_MAX_SIZE = 500 * 1024 * 1024;
const AUDIO_MAX_SIZE = 20 * 1024 * 1024;
const FILE_MAX_SIZE = 100 * 1024 * 1024;

export class MessageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessageUploadError";
  }
}

function maxSizeForKind(kind: MessageMediaKind) {
  if (kind === "image") return IMAGE_MAX_SIZE;
  if (kind === "video") return VIDEO_MAX_SIZE;
  if (kind === "audio") return AUDIO_MAX_SIZE;
  return FILE_MAX_SIZE;
}

function prettySize(limit: number) {
  if (limit >= 1024 * 1024) {
    return `${Math.round(limit / (1024 * 1024))} MB`;
  }
  return `${Math.round(limit / 1024)} KB`;
}

export function resolveMediaKind(file: File): MessageMediaKind {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  throw new MessageUploadError(i18n.t("upload.imagesVideosOnly"));
}

export function validateMessageMediaFile(file: File, kind: MessageMediaKind) {
  const maxSize = maxSizeForKind(kind);
  if (file.size > maxSize) {
    const label = i18n.t(`media.${kind}` as "media.image");
    throw new MessageUploadError(i18n.t("upload.sizeLimit", { type: label, size: prettySize(maxSize) }));
  }
}

export function uploadFormData(url: string, formData: FormData, onProgress?: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(1, event.loaded / event.total));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }

      let message = i18n.t("upload.failed");
      try {
        const payload = JSON.parse(request.responseText) as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        if (request.responseText.trim()) message = request.responseText.trim();
      }
      reject(new MessageUploadError(message));
    });
    request.addEventListener("error", () => reject(new MessageUploadError(i18n.t("upload.failed"))));
    request.addEventListener("abort", () => reject(new MessageUploadError(i18n.t("upload.cancelled"))));
    request.send(formData);
  });
}

export async function uploadMessageMedia(file: File, kind: MessageMediaKind, onProgress?: (progress: number) => void) {
  return uploadMessageMediaWith(file, kind, (mediaKind, fileName, contentType) => api.createMessageUpload(mediaKind, fileName, contentType), onProgress);
}

export async function uploadMessageMediaWith(
  file: File,
  kind: MessageMediaKind,
  createUpload: (kind: MessageMediaKind, fileName: string, contentType?: string) => ReturnType<typeof api.createMessageUpload>,
  onProgress?: (progress: number) => void
) {
  validateMessageMediaFile(file, kind);

  onProgress?.(0.02);
  const upload = await createUpload(kind, file.name, file.type);
  const formData = new FormData();
  formData.set("token", upload.upload_token);
  formData.set("key", upload.key);
  formData.set("file", file);

  await uploadFormData(upload.upload_url, formData, onProgress);

  return upload;
}

export function toMessageUploadError(error: unknown) {
  if (error instanceof MessageUploadError) return error;
  if (error instanceof ApiError) return new MessageUploadError(error.message);
  return new MessageUploadError(i18n.t("upload.failed"));
}
