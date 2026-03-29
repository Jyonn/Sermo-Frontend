import { ApiError, api } from "./api";
import type { MessageMediaKind } from "../types";

const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const VIDEO_MAX_SIZE = 500 * 1024 * 1024;
const AUDIO_MAX_SIZE = 20 * 1024 * 1024;

export class MessageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessageUploadError";
  }
}

function maxSizeForKind(kind: MessageMediaKind) {
  if (kind === "image") return IMAGE_MAX_SIZE;
  if (kind === "video") return VIDEO_MAX_SIZE;
  return AUDIO_MAX_SIZE;
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
    throw new MessageUploadError(`${kind === "image" ? "图片" : kind === "video" ? "视频" : "语音"}不能超过 ${prettySize(maxSize)}。`);
  }
}

export async function uploadMessageMedia(file: File, kind: MessageMediaKind) {
  validateMessageMediaFile(file, kind);

  const upload = await api.createMessageUpload(kind, file.name, file.type);
  const formData = new FormData();
  formData.set("token", upload.upload_token);
  formData.set("key", upload.key);
  formData.set("file", file);

  const response = await fetch(upload.upload_url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = "资源上传失败";
    try {
      const payload = JSON.parse(raw) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      if (raw.trim()) {
        message = raw.trim();
      }
    }
    throw new MessageUploadError(message);
  }

  return upload;
}

export function toMessageUploadError(error: unknown) {
  if (error instanceof MessageUploadError) return error;
  if (error instanceof ApiError) return new MessageUploadError(error.message);
  return new MessageUploadError("资源上传失败");
}
