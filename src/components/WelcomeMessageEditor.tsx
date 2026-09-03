import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ApiError, api } from "../lib/api";
import { audioFileExtension, createNoiseReducedAudioCapture, preferredAudioMimeType, type NoiseReducedAudioCapture } from "../lib/audioCapture";
import { useI18n } from "../lib/language";
import { resolveMediaKind, uploadMessageMedia } from "../lib/messageUpload";
import { copyText } from "../lib/presentation";
import { showToast } from "../lib/toast";
import type { AvatarFrameStyle, ChatBackgroundTheme, ChatBubbleStyle, ChatMessageDTO, MessageMediaKind, WelcomeTemplateDTO, WelcomeTemplateMessageDTO } from "../types";
import { ChatPreview, ChatVoiceComposerRow, ComposerSvgIcon, type VoiceComposerState } from "../pages/ChatsPage";
import { ChatComposerTextRow } from "./ChatComposerTextRow";
import { MentionComposerInput, type MentionComposerHandle } from "./MentionComposerInput";
import { SideDrawer } from "./SideDrawer";

const MESSAGE_TYPE_TEXT = 0;
const MESSAGE_TYPE_IMAGE = 1;
const MESSAGE_TYPE_FILE = 2;
const MESSAGE_TYPE_VIDEO = 4;
const MESSAGE_TYPE_AUDIO = 5;
const AUDIO_MAX_DURATION_SECONDS = 60;
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
  const composerInputRef = useRef<MentionComposerHandle | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const audioCaptureRef = useRef<NoiseReducedAudioCapture | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const waveformFrameRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const recordingAttemptRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewUriRef = useRef("");
  const [state, setState] = useState<WelcomeTemplateDTO | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [composerMoreOpen, setComposerMoreOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [voiceComposer, setVoiceComposer] = useState<VoiceComposerState>({
    open: false,
    phase: "idle",
    durationSeconds: 0,
    bars: Array.from({ length: 24 }, () => 0.28),
    blob: null,
    mimeType: "",
  });
  const [voicePreviewUri, setVoicePreviewUri] = useState("");
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false);
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

  const addMedia = async (file?: File, knownDuration?: number) => {
    if (!file || !state?.can_add || saving) return;
    let kind = resolveMediaKind(file);
    if (file.type.startsWith("audio/")) kind = "audio";
    setSaving(true);
    try {
      const upload = await uploadMessageMedia(file, kind, undefined, knownDuration ?? await audioDuration(file));
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
    }
  };

  const cleanupRecordingResources = () => {
    if (waveformFrameRef.current) {
      cancelAnimationFrame(waveformFrameRef.current);
      waveformFrameRef.current = null;
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    analyserRef.current = null;
    audioCaptureRef.current?.cleanup();
    audioCaptureRef.current = null;
    mediaRecorderRef.current = null;
  };

  const resetVoiceComposer = () => {
    recordingCancelledRef.current = false;
    cleanupRecordingResources();
    recordingChunksRef.current = [];
    voicePreviewAudioRef.current?.pause();
    setVoicePreviewPlaying(false);
    setVoicePreviewUri((current) => {
      if (current) URL.revokeObjectURL(current);
      voicePreviewUriRef.current = "";
      return "";
    });
    setVoiceComposer({
      open: false,
      phase: "idle",
      durationSeconds: 0,
      bars: Array.from({ length: 24 }, () => 0.28),
      blob: null,
      mimeType: "",
    });
  };

  useEffect(() => {
    if (open) return;
    recordingAttemptRef.current += 1;
    recordingCancelledRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    else resetVoiceComposer();
  }, [open]);

  useEffect(() => () => {
    recordingAttemptRef.current += 1;
    recordingCancelledRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    cleanupRecordingResources();
    if (voicePreviewUriRef.current) URL.revokeObjectURL(voicePreviewUriRef.current);
  }, []);

  const startVoiceRecording = async () => {
    if (!state?.can_add || saving || voiceComposer.open) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showToast(t("audio.unsupported"), "error");
      return;
    }

    composerInputRef.current?.blur();
    setComposerMoreOpen(false);
    setEmojiPickerOpen(false);
    const attempt = recordingAttemptRef.current + 1;
    recordingAttemptRef.current = attempt;
    recordingCancelledRef.current = false;
    recordingChunksRef.current = [];
    setVoiceComposer({
      open: true,
      phase: "requesting",
      durationSeconds: 0,
      bars: Array.from({ length: 24 }, () => 0.2),
      blob: null,
      mimeType: "",
    });

    try {
      const capture = await createNoiseReducedAudioCapture();
      if (attempt !== recordingAttemptRef.current) {
        capture.cleanup();
        return;
      }
      const mimeType = preferredAudioMimeType();
      audioCaptureRef.current = capture;
      const mediaRecorder = mimeType ? new MediaRecorder(capture.stream, { mimeType }) : new MediaRecorder(capture.stream);
      mediaRecorderRef.current = mediaRecorder;

      if (capture.analyser) {
        analyserRef.current = capture.analyser;
        const data = new Uint8Array(capture.analyser.frequencyBinCount);
        const updateWaveform = () => {
          const analyser = analyserRef.current;
          if (!analyser) return;
          analyser.getByteFrequencyData(data);
          const bucketSize = Math.max(1, Math.floor(data.length / 24));
          const bars = Array.from({ length: 24 }, (_, index) => {
            const slice = data.slice(index * bucketSize, (index + 1) * bucketSize);
            const average = slice.length ? slice.reduce((sum, value) => sum + value, 0) / slice.length : 0;
            return Math.max(0.18, average / 255);
          });
          setVoiceComposer((current) => current.open ? { ...current, bars } : current);
          waveformFrameRef.current = requestAnimationFrame(updateWaveform);
        };
        waveformFrameRef.current = requestAnimationFrame(updateWaveform);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const nextMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type: nextMimeType });
        const durationSeconds = Math.min(AUDIO_MAX_DURATION_SECONDS, Math.max(0, (Date.now() - recordingStartedAtRef.current) / 1000));
        cleanupRecordingResources();
        if (recordingCancelledRef.current) {
          resetVoiceComposer();
          return;
        }
        if (blob.size === 0 || durationSeconds < 0.4) {
          resetVoiceComposer();
          showToast(t("audio.tooShort"), "error");
          return;
        }
        const previewUri = URL.createObjectURL(blob);
        setVoicePreviewUri((current) => {
          if (current) URL.revokeObjectURL(current);
          voicePreviewUriRef.current = previewUri;
          return previewUri;
        });
        setVoiceComposer((current) => ({ ...current, phase: "recorded", durationSeconds, blob, mimeType: nextMimeType }));
      };

      mediaRecorder.start();
      recordingStartedAtRef.current = Date.now();
      setVoiceComposer({
        open: true,
        phase: "recording",
        durationSeconds: 0,
        bars: Array.from({ length: 24 }, () => 0.28),
        blob: null,
        mimeType: mediaRecorder.mimeType || mimeType || "audio/webm",
      });
      recordingTimerRef.current = window.setInterval(() => {
        const durationSeconds = Math.min(AUDIO_MAX_DURATION_SECONDS, (Date.now() - recordingStartedAtRef.current) / 1000);
        setVoiceComposer((current) => ({ ...current, durationSeconds }));
        if (durationSeconds >= AUDIO_MAX_DURATION_SECONDS && mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 120);
    } catch (error) {
      if (attempt !== recordingAttemptRef.current) return;
      resetVoiceComposer();
      const errorName = error instanceof DOMException ? error.name : "";
      const message = errorName === "NotAllowedError"
        ? t("audio.permissionRequired")
        : errorName === "NotFoundError"
          ? t("audio.noMicrophone")
          : errorName === "NotReadableError"
            ? t("audio.inUse")
            : t("audio.startUnavailable");
      showToast(message, "error");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current?.state !== "recording") return;
    setVoiceComposer((current) => ({ ...current, phase: "stopping" }));
    mediaRecorderRef.current.stop();
  };

  const cancelVoiceRecording = () => {
    recordingAttemptRef.current += 1;
    recordingCancelledRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    else resetVoiceComposer();
  };

  const toggleVoicePreview = async () => {
    const audio = voicePreviewAudioRef.current;
    if (!audio || voiceComposer.phase !== "recorded") return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setVoicePreviewPlaying(false);
      showToast(t("audio.previewFailed"), "error");
    }
  };

  const sendRecordedVoice = async () => {
    if (!voiceComposer.blob || voiceComposer.phase !== "recorded") return;
    const duration = voiceComposer.durationSeconds;
    const file = new File([voiceComposer.blob], `voice-message.${audioFileExtension(voiceComposer.mimeType)}`, {
      type: voiceComposer.mimeType || "audio/webm",
    });
    setVoiceComposer((current) => ({ ...current, phase: "sending" }));
    await addMedia(file, duration);
    resetVoiceComposer();
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

  const copySelectedMessage = async () => {
    const content = messageMenu?.message.content ?? "";
    setMessageMenu(null);
    if (!await copyText(content)) {
      showToast(t("common.copyFailed"), "error");
      return;
    }
    showToast(t("message.batchCopied", { count: 1 }));
  };

  const moveSelectedMessage = async (offset: -1 | 1) => {
    const messageId = messageMenu?.message.message_id;
    setMessageMenu(null);
    if (!state || messageId == null || saving) return;
    const index = state.messages.findIndex((message) => message.template_message_id === messageId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= state.messages.length) return;
    const next = [...state.messages];
    [next[index], next[target]] = [next[target], next[index]];
    await persist(next);
  };

  const selectedMessageIndex = messageMenu && state
    ? state.messages.findIndex((message) => message.template_message_id === messageMenu.message.message_id)
    : -1;
  const selectedMessageIsText = messageMenu?.message.type === MESSAGE_TYPE_TEXT;

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
        <form className={`composer welcome-template-composer${voiceComposer.open ? " is-recording-mode" : ""}`} onSubmit={(event) => void addText(event)} ref={composerRef}>
          {!voiceComposer.open ? <ChatComposerTextRow
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
              aria-label={emojiPickerOpen ? t("emoji.keyboard") : t("emoji.choose")}
              className={`composer-emoji-button${emojiPickerOpen ? " is-open" : ""}`}
              disabled={!state?.can_add || saving}
              onClick={() => {
                setComposerMoreOpen(false);
                if (emojiPickerOpen) {
                  setEmojiPickerOpen(false);
                  window.requestAnimationFrame(() => composerInputRef.current?.focus());
                } else {
                  setEmojiPickerOpen(true);
                }
              }}
              type="button"
            ><ComposerSvgIcon className="composer-inline-svg" kind={emojiPickerOpen ? "keyboard" : "emoji"} /></button>}
            leadingAction={<button aria-label={t("audio.record")} className="composer-action-button" disabled={!state?.can_add || saving} onClick={() => void startVoiceRecording()} type="button"><ComposerSvgIcon className="composer-inline-svg" kind="mic" /></button>}
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
          /> : <ChatVoiceComposerRow
            audioRef={voicePreviewAudioRef}
            labels={{
              generating: t("audio.generating"),
              pausePreview: t("audio.pausePreview"),
              preparingMicrophone: t("audio.preparingMicrophone"),
              preview: t("audio.preview"),
              stopRecording: t("audio.stopRecording"),
            }}
            onCancel={cancelVoiceRecording}
            onPreviewPlayingChange={setVoicePreviewPlaying}
            onSend={() => void sendRecordedVoice()}
            onStop={stopVoiceRecording}
            onTogglePreview={() => void toggleVoicePreview()}
            previewPlaying={voicePreviewPlaying}
            previewUri={voicePreviewUri}
            state={voiceComposer}
          />}
          {!voiceComposer.open && emojiPickerOpen ? <div className="composer-emoji-panel"><div className="composer-emoji-grid">
            {WELCOME_EMOJIS.map((emoji) => <button key={emoji} onClick={() => composerInputRef.current?.insertText(emoji)} type="button">{emoji}</button>)}
          </div></div> : null}
          {!voiceComposer.open ? <div className={`composer-actions-reveal${composerMoreOpen ? " is-open" : ""}`} aria-hidden={!composerMoreOpen}>
            <div className="composer-actions-grid">
              <button className="composer-action-tile" disabled={!state?.can_add || saving} onClick={() => galleryInputRef.current?.click()} type="button">
                <span className="composer-action-tile-icon"><ComposerSvgIcon kind="album" /></span>
                <span>{t("media.gallery")}</span>
              </button>
              <button className="composer-action-tile" disabled={!state?.can_add || saving} onClick={() => fileInputRef.current?.click()} type="button">
                <span className="composer-action-tile-icon"><ComposerSvgIcon kind="file" /></span>
                <span>{t("media.file")}</span>
              </button>
            </div>
          </div> : null}
          <input ref={galleryInputRef} accept="image/*,video/*" hidden onChange={(event) => void addMedia(event.target.files?.[0])} type="file" />
          <input ref={fileInputRef} accept="audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" hidden onChange={(event) => void addMedia(event.target.files?.[0])} type="file" />
        </form>
      </div>
      {messageMenu ? <div className="message-context-layer" onClick={() => setMessageMenu(null)} role="presentation">
        <div
          className={`message-context-menu ${messageMenu.placement === "top" ? "above" : "below"}`}
          onClick={(event) => event.stopPropagation()}
          ref={messageMenuRef}
          style={{ left: messageMenu.anchorX, top: messageMenu.anchorY }}
        >
          <div className={`message-context-actions welcome-message-context-actions${selectedMessageIsText ? " has-copy" : ""}`}>
            {selectedMessageIsText ? <button className="message-context-button" disabled={saving} onClick={() => void copySelectedMessage()} type="button">
              <span className="material-symbols-outlined">content_copy</span>
              {t("common.copy")}
            </button> : null}
            <button className="message-context-button" disabled={saving || selectedMessageIndex <= 0} onClick={() => void moveSelectedMessage(-1)} type="button">
              <span className="material-symbols-outlined">arrow_upward</span>
              {t("profile.welcomeMoveEarlier")}
            </button>
            <button className="message-context-button" disabled={saving || selectedMessageIndex < 0 || selectedMessageIndex >= previewMessages.length - 1} onClick={() => void moveSelectedMessage(1)} type="button">
              <span className="material-symbols-outlined">arrow_downward</span>
              {t("profile.welcomeMoveLater")}
            </button>
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
