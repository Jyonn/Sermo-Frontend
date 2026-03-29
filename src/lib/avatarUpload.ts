import { ApiError, api } from "./api";

export const MAX_CUSTOM_AVATAR_SIZE = 5 * 1024 * 1024;

export class AvatarUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarUploadError";
  }
}

function validateImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new AvatarUploadError("请选择图片文件。");
  }
  if (file.size > MAX_CUSTOM_AVATAR_SIZE) {
    throw new AvatarUploadError("图片不能超过 5 MB。");
  }
}

export async function uploadCustomAvatar(file: File) {
  validateImageFile(file);

  const upload = await api.createCustomAvatarUpload(file.name, file.type);
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
    let message = "头像上传失败";
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
    throw new AvatarUploadError(message);
  }

  try {
    return await api.setCustomAvatar(upload.key);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new AvatarUploadError(error.message);
    }
    throw error;
  }
}
