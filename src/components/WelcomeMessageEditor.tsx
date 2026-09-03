import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, api } from "../lib/api";
import { useI18n } from "../lib/language";
import { resolveMediaKind, uploadMessageMedia } from "../lib/messageUpload";
import { showToast } from "../lib/toast";
import type { AvatarFrameStyle, ChatBackgroundTheme, ChatBubbleStyle, ChatMessageDTO, MessageMediaKind, WelcomeTemplateDTO, WelcomeTemplateMessageDTO } from "../types";
import { ChatPreview } from "../pages/ChatsPage";
import { SideDrawer } from "./SideDrawer";

const MESSAGE_TYPE_TEXT = 0;
const MESSAGE_TYPE_IMAGE = 1;
const MESSAGE_TYPE_FILE = 2;
const MESSAGE_TYPE_VIDEO = 4;
const MESSAGE_TYPE_AUDIO = 5;

function messageTypeForKind(kind: MessageMediaKind) {
  if (kind === "image") return MESSAGE_TYPE_IMAGE;
  if (kind === "video") return MESSAGE_TYPE_VIDEO;
  if (kind === "audio") return MESSAGE_TYPE_AUDIO;
  return MESSAGE_TYPE_FILE;
}

async function audioDuration(file: File) {
  if (!file.type.startsWith("audio/")) return undefined;
  const uri = URL.createObjectURL(file);
  try {
    return await new Promise<number | undefined>((resolve) => {
      const audio = new Audio(uri);
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : undefined);
      audio.onerror = () => resolve(undefined);
    });
  } finally {
    URL.revokeObjectURL(uri);
  }
}

interface WelcomeMessageEditorProps {
  avatarCacheKey?: string | null;
  avatarFrameStyle?: AvatarFrameStyle;
  avatarUri?: string | null;
  backgroundTheme?: ChatBackgroundTheme;
  backgroundUri?: string | null;
  bubbleStyle?: ChatBubbleStyle;
  isPermanentVip?: boolean;
  name: string;
  onClose: () => void;
  onSaved: (payload: WelcomeTemplateDTO) => void;
  open: boolean;
  userId: number;
}

export function WelcomeMessageEditor({ avatarCacheKey, avatarFrameStyle, avatarUri, backgroundTheme = "default", backgroundUri, bubbleStyle, isPermanentVip, name, onClose, onSaved, open, userId }: WelcomeMessageEditorProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<WelcomeTemplateDTO | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    api.getWelcomeMessage(controller.signal)
      .then(setState)
      .catch((error) => showToast(error instanceof ApiError ? error.message : t("profile.welcomeLoadFailed"), "error"))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, t]);

  const persist = async (messages: WelcomeTemplateMessageDTO[]) => {
    setSaving(true);
    try {
      const payload = await api.updateWelcomeMessages(messages.map((message) => ({
        template_message_id: message.template_message_id > 0 ? message.template_message_id : undefined,
        type: message.type,
        content: message.content,
        resource_id: message.resource_id,
      })));
      setState(payload);
      onSaved(payload);
      return true;
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("profile.welcomeUpdateFailed"), "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addText = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !state || !state.can_add || saving) return;
    const next = [...state.messages, {
      template_message_id: -Date.now(),
      type: MESSAGE_TYPE_TEXT,
      content: text,
      payload: { kind: "text" as const, text },
      position: state.messages.length,
    }];
    if (await persist(next)) setDraft("");
  };

  const addMedia = async (file?: File) => {
    if (!file || !state?.can_add || saving) return;
    let kind = resolveMediaKind(file);
    if (file.type.startsWith("audio/")) kind = "audio";
    setSaving(true);
    try {
      const upload = await uploadMessageMedia(file, kind, undefined, await audioDuration(file));
      if (!upload.resource) throw new Error("missing resource");
      const resource = upload.resource;
      const next = [...state.messages, {
        template_message_id: -Date.now(),
        type: messageTypeForKind(kind),
        content: "",
        resource_id: resource.resource_id,
        payload: {
          kind,
          uri: resource.uri,
          thumbnail_uri: resource.thumbnail_uri || undefined,
          mime_type: resource.mime_type,
          file_name: resource.file_name,
          file_size: resource.file_size,
          duration_seconds: resource.duration_seconds || undefined,
        },
        position: state.messages.length,
      }];
      setSaving(false);
      await persist(next);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("upload.failed"), "error");
      setSaving(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteMessage = async (id: number) => {
    if (!state || saving || state.messages.length <= 1) return;
    await persist(state.messages.filter((message) => message.template_message_id !== id));
  };

  const count = state?.messages.length ?? 0;
  const previewMessages: ChatMessageDTO[] = (state?.messages ?? []).map((message) => ({
    message_id: message.template_message_id,
    client_message_id: `welcome-template-${message.template_message_id}`,
    user: {
      user_id: userId,
      name,
      avatar_uri: avatarUri ?? undefined,
      avatar_cache_key: avatarCacheKey ?? undefined,
      avatar_frame_style: avatarFrameStyle,
      chat_bubble_style: bubbleStyle,
      is_permanent_vip: isPermanentVip,
    },
    type: message.type,
    content: message.content,
    payload: message.payload,
    created_at: message.position + 1,
  }));
  return <SideDrawer className="welcome-template-drawer" historyKey="welcome-messages" onClose={onClose} open={open} title={t("profile.welcomeMessages")}>
    <div className="welcome-template-editor">
      <header className="welcome-template-context">
        <span className="material-symbols-outlined">auto_awesome</span>
        <div><strong>{t("profile.welcomeAutoSend")}</strong><small>{t("profile.welcomeAutoSendHint")}</small></div>
        <b>{count}/{state?.max_messages ?? 3}</b>
      </header>
      {state?.delete_to_limit ? <div className="welcome-template-limit-note"><span className="material-symbols-outlined">info</span>{t("profile.welcomeDeleteFirst", { count: state.delete_to_limit })}</div> : null}
      <div className="welcome-template-thread">
        {loading ? <div className="welcome-template-loading">{t("common.loading")}</div> : <ChatPreview
          backgroundTheme={backgroundTheme}
          backgroundUri={backgroundUri}
          className="welcome-template-chat"
          firstPersonUserId={-1}
          initialScrollToEnd
          messages={previewMessages}
          renderMessageFooter={(message) => <button
            aria-label={t("common.delete")}
            className="welcome-template-delete"
            disabled={saving || previewMessages.length <= 1}
            onClick={() => void deleteMessage(message.message_id)}
            type="button"
          ><span className="material-symbols-outlined">delete</span><span>{t("common.delete")}</span></button>}
          showAuthors={false}
        />}
      </div>
      <form className="welcome-template-composer" onSubmit={(event) => void addText(event)}>
        <button aria-label={t("profile.welcomeAddMedia")} disabled={!state?.can_add || saving} onClick={() => fileInputRef.current?.click()} type="button"><span className="material-symbols-outlined">add</span></button>
        <textarea disabled={!state?.can_add || saving} maxLength={512} onChange={(event) => setDraft(event.target.value)} placeholder={state?.can_add ? t("profile.welcomeMessagePlaceholder") : t("profile.welcomeLimitReached")} rows={1} value={draft} />
        <button aria-label={t("common.send")} className="is-send" disabled={!draft.trim() || !state?.can_add || saving} type="submit"><span className="material-symbols-outlined">send</span></button>
        <input ref={fileInputRef} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" hidden onChange={(event) => void addMedia(event.target.files?.[0])} type="file" />
      </form>
    </div>
  </SideDrawer>;
}
