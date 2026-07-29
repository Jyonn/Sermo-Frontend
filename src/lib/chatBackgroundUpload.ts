import { ApiError, api } from "./api";
import { i18n } from "./language";

export const MAX_CHAT_BACKGROUND_SIZE = 10 * 1024 * 1024;

export class ChatBackgroundUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatBackgroundUploadError";
  }
}

export async function uploadChatBackground(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new ChatBackgroundUploadError(i18n.t("upload.selectImage"));
  }
  if (file.size > MAX_CHAT_BACKGROUND_SIZE) {
    throw new ChatBackgroundUploadError(i18n.t("upload.imageLimit", { size: "10 MB" }));
  }

  const upload = await api.createChatBackgroundUpload(file.name, file.type);
  const formData = new FormData();
  formData.set("token", upload.upload_token);
  formData.set("key", upload.key);
  formData.set("file", file);

  const response = await fetch(upload.upload_url, { method: "POST", body: formData });
  if (!response.ok) {
    throw new ChatBackgroundUploadError(i18n.t("upload.backgroundFailed"));
  }

  try {
    return await api.setChatBackground("custom", upload.key);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ChatBackgroundUploadError(error.message);
    }
    throw error;
  }
}
