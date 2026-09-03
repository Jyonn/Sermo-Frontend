import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ApiError, api } from "../lib/api";
import { useI18n } from "../lib/language";
import { resolveMediaKind, uploadMessageMedia } from "../lib/messageUpload";
import { showToast } from "../lib/toast";
import type { AvatarFrameStyle, ChatBackgroundTheme, ChatBubbleStyle, ChatMessageDTO, MessageMediaKind, WelcomeTemplateDTO, WelcomeTemplateMessageDTO } from "../types";
import { ChatPreview } from "../pages/ChatsPage";
import { ChatComposerTextRow } from "./ChatComposerTextRow";
import { MentionComposerInput, type MentionComposerHandle } from "./MentionComposerInput";
import { SideDrawer } from "./SideDrawer";

const MESSAGE_TYPE_TEXT = 0;
const MESSAGE_TYPE_IMAGE = 1;
const MESSAGE_TYPE_FILE = 2;
const MESSAGE_TYPE_VIDEO = 4;
const MESSAGE_TYPE_AUDIO = 5;
const WELCOME_EMOJIS = ["😀", "😄", "😂", "🥹", "😊", "🙂", "😉", "😍", "🥰", "🤔", "🤭", "😅", "😭", "😤", "🥳", "🤩", "👍", "👏", "🙏", "👀", "❤️", "💚", "✨", "🎉"];

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
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const composerInputRef = useRef<MentionComposerHandle | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<WelcomeTemplateDTO | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [composerMoreOpen, setComposerMoreOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [messageMenu, setMessageMenu] = useState<{
    message: ChatMessageDTO;
    anchorX: number;
    anchorY: number;
    placement: "top" | "bottom";
  } | null>(null);

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
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (audioInputRef.current) audioInputRef.current.value = "";
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
  const chatSceneStyle = backgroundTheme === "custom" && backgroundUri
    ? ({ "--chat-background-image": `url("${backgroundUri.replace(/"/g, "%22")}")` } as CSSProperties)
    : undefined;

  useLayoutEffect(() => {
    const menu = messageMenuRef.current;
    if (!menu || !messageMenu) return;
    menu.style.setProperty("--message-menu-shift-x", "0px");
    const rect = menu.getBoundingClientRect();
    const safeInset = 12;
    let shift = rect.left < safeInset ? safeInset - rect.left : 0;
    if (rect.right + shift > window.innerWidth - safeInset) shift -= rect.right + shift - (window.innerWidth - safeInset);
    menu.style.setProperty("--message-menu-shift-x", `${Math.round(shift)}px`);
  }, [messageMenu]);

  const openMessageMenu = (message: ChatMessageDTO, element: HTMLElement, pointerX?: number) => {
    const rect = element.getBoundingClientRect();
    const spaceAbove = rect.top - 12;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const placement = spaceAbove >= 100 || spaceAbove > spaceBelow ? "top" : "bottom";
    setMessageMenu({
      message,
      anchorX: pointerX ?? rect.left + rect.width / 2,
      anchorY: placement === "top" ? rect.top - 10 : rect.bottom + 10,
      placement,
    });
  };

  const deleteSelectedMessage = async () => {
    const messageId = messageMenu?.message.message_id;
    setMessageMenu(null);
    if (messageId == null) return;
    await deleteMessage(messageId);
  };

  return <SideDrawer
    className={`welcome-template-drawer chat-background-${backgroundTheme}`}
    historyKey="welcome-messages"
    onClose={onClose}
    open={open}
    title={t("profile.welcomeMessages")}
    titleAccessory={<span className="welcome-template-count">{count}/{state?.max_messages ?? 3}</span>}
  >
    <div className="welcome-template-editor chat-detail-active">
      {state?.delete_to_limit ? <div className="welcome-template-limit-note"><span className="material-symbols-outlined">info</span>{t("profile.welcomeDeleteFirst", { count: state.delete_to_limit })}</div> : null}
      <div className={`chat-detail-scene chat-background-${backgroundTheme}`} style={chatSceneStyle}>
        {loading ? <div className="welcome-template-loading">{t("common.loading")}</div> : <ChatPreview
          bare
          className="welcome-template-message-scroll"
          firstPersonUserId={-1}
          initialScrollToEnd
          messages={previewMessages}
          onMessageAction={openMessageMenu}
          showAuthors={false}
          showDividers={false}
        />}
        <form className="composer welcome-template-composer" onSubmit={(event) => void addText(event)} ref={composerRef}>
          <ChatComposerTextRow
            input={<MentionComposerInput
              className="textarea composer-input composer-rich-input"
              members={[]}
              onChange={setDraft}
              onFocus={() => setEmojiPickerOpen(false)}
              onMentionQueryChange={() => undefined}
              onSelectFirstMention={() => false}
              onSubmit={() => composerRef.current?.requestSubmit()}
              placeholder={state?.can_add ? t("profile.welcomeMessagePlaceholder") : t("profile.welcomeLimitReached")}
              ref={composerInputRef}
              value={draft}
            />}
            inputAccessory={<button
              aria-expanded={emojiPickerOpen}
              aria-label={t("emoji.choose")}
              className={`composer-emoji-button${emojiPickerOpen ? " is-open" : ""}`}
              disabled={!state?.can_add || saving}
              onClick={() => {
                setComposerMoreOpen(false);
                setEmojiPickerOpen((current) => !current);
              }}
              type="button"
            ><span className="material-symbols-outlined">{emojiPickerOpen ? "keyboard" : "sentiment_satisfied"}</span></button>}
            leadingAction={<button aria-label={t("audio.record")} className="composer-action-button" disabled={!state?.can_add || saving} onClick={() => audioInputRef.current?.click()} type="button"><span className="material-symbols-outlined">mic</span></button>}
            trailingAction={<button
              aria-expanded={composerMoreOpen}
              aria-label={composerMoreOpen ? t("common.collapseMore") : t("common.expandMore")}
              className={`composer-plus${composerMoreOpen ? " is-open" : ""}`}
              disabled={!state?.can_add || saving}
              onClick={() => {
                setEmojiPickerOpen(false);
                setComposerMoreOpen((current) => !current);
              }}
              type="button"
            ><span className="material-symbols-outlined">add</span></button>}
          />
          {emojiPickerOpen ? <div className="composer-emoji-panel"><div className="composer-emoji-grid">
            {WELCOME_EMOJIS.map((emoji) => <button key={emoji} onClick={() => composerInputRef.current?.insertText(emoji)} type="button">{emoji}</button>)}
          </div></div> : null}
          <div className={`composer-actions-reveal${composerMoreOpen ? " is-open" : ""}`} aria-hidden={!composerMoreOpen}>
            <div className="composer-actions-grid">
              <button className="composer-action-tile" disabled={!state?.can_add || saving} onClick={() => galleryInputRef.current?.click()} type="button">
                <span className="composer-action-tile-icon"><span className="material-symbols-outlined">photo_library</span></span>
                <span>{t("media.gallery")}</span>
              </button>
              <button className="composer-action-tile" disabled={!state?.can_add || saving} onClick={() => fileInputRef.current?.click()} type="button">
                <span className="composer-action-tile-icon"><span className="material-symbols-outlined">draft</span></span>
                <span>{t("media.file")}</span>
              </button>
            </div>
          </div>
          <input ref={galleryInputRef} accept="image/*,video/*" hidden onChange={(event) => void addMedia(event.target.files?.[0])} type="file" />
          <input ref={fileInputRef} accept="audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" hidden onChange={(event) => void addMedia(event.target.files?.[0])} type="file" />
          <input ref={audioInputRef} accept="audio/*" capture hidden onChange={(event) => void addMedia(event.target.files?.[0])} type="file" />
        </form>
      </div>
      {messageMenu ? <div className="message-context-layer" onClick={() => setMessageMenu(null)} role="presentation">
        <div
          className={`message-context-menu ${messageMenu.placement === "top" ? "above" : "below"}`}
          onClick={(event) => event.stopPropagation()}
          ref={messageMenuRef}
          style={{ left: messageMenu.anchorX, top: messageMenu.anchorY }}
        >
          <div className="message-context-actions is-single">
            <button className="message-context-button danger" disabled={saving || previewMessages.length <= 1} onClick={() => void deleteSelectedMessage()} type="button">
              <span className="material-symbols-outlined">delete</span>
              {t("common.delete")}
            </button>
          </div>
        </div>
      </div> : null}
    </div>
  </SideDrawer>;
}
