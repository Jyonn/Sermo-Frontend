import { ApiError, api } from "./api";
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
  throw new MessageUploadError("目前只支持图片和视频。");
}

export function validateMessageMediaFile(file: File, kind: MessageMediaKind) {
  const maxSize = maxSizeForKind(kind);
  if (file.size > maxSize) {
    const label = kind === "image" ? "图片" : kind === "video" ? "视频" : kind === "audio" ? "语音" : "文件";
    throw new MessageUploadError(`${label}不能超过 ${prettySize(maxSize)}。`);
  }
}

function uploadFormData(url: string, formData: FormData, onProgress?: (progress: number) => void) {
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

      let message = "资源上传失败";
      try {
        const payload = JSON.parse(request.responseText) as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        if (request.responseText.trim()) message = request.responseText.trim();
      }
      reject(new MessageUploadError(message));
    });
    request.addEventListener("error", () => reject(new MessageUploadError("资源上传失败")));
    request.addEventListener("abort", () => reject(new MessageUploadError("资源上传已取消")));
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
  return new MessageUploadError("资源上传失败");
}
