import { api } from "./api";
import { uploadFormData } from "./messageUpload";
import type { StickerDTO } from "../types";

const STICKER_MAX_SIZE = 10 * 1024 * 1024;

async function sha256(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function addStickerFile(file: File, onProgress?: (progress: number) => void): Promise<StickerDTO> {
  if (!file.type.startsWith("image/")) throw new Error("sticker_image_required");
  if (file.size > STICKER_MAX_SIZE) throw new Error("sticker_too_large");

  onProgress?.(0.02);
  const contentHash = await sha256(file);
  onProgress?.(0.08);
  const prepared = await api.prepareSticker({
    content_hash: contentHash,
    file_name: file.name || "sticker.png",
    content_type: file.type,
    file_size: file.size,
  });
  if (!prepared.upload_required && prepared.sticker) {
    onProgress?.(1);
    return prepared.sticker;
  }
  if (!prepared.upload) throw new Error("sticker_upload_unavailable");

  const formData = new FormData();
  formData.set("token", prepared.upload.upload_token);
  formData.set("key", prepared.upload.key);
  formData.set("file", file);
  await uploadFormData(prepared.upload.upload_url, formData, (value) => onProgress?.(0.08 + value * 0.82));
  const sticker = await api.completeSticker({
    content_hash: contentHash,
    key: prepared.upload.key,
    content_type: file.type,
    file_size: file.size,
  });
  onProgress?.(1);
  return sticker;
}
