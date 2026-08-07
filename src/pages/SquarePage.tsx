import { useEffect, useMemo, useRef, useState } from "react";
import { AppChrome } from "../components/AppChrome";
import { BottomSheet } from "../components/BottomSheet";
import { FeedbackState } from "../components/FeedbackState";
import { ImageLightbox } from "../components/ImageLightbox";
import { SideDrawer } from "../components/SideDrawer";
import { TabPageHeader } from "../components/TabPageHeader";
import { UserAvatar } from "../components/UserAvatar";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { toMessageUploadError, uploadMessageMediaWith } from "../lib/messageUpload";
import type { SquareStatementCommentDTO, SquareStatementDTO, SquareStatementDraftMedia } from "../types";

type SelectedPhoto = {
  id: string;
  file: File;
  preview: string;
};

const MAX_TEXT_LENGTH = 140;
const MAX_PHOTOS = 9;
const MAX_AUDIO_SECONDS = 60;

function formatStatementTime(timestamp: number, language: string) {
  return new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function StatementCard({ statement, language, onOpenComments, onOpenImage }: {
  statement: SquareStatementDTO;
  language: string;
  onOpenComments: () => void;
  onOpenImage: (index: number) => void;
}) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const images = statement.media.filter((item) => item.kind === "image");
  const audio = statement.media.find((item) => item.kind === "audio");
  return (
    <article className="square-statement-card">
      <header className="square-statement-author">
        <UserAvatar
          className="square-statement-avatar"
          frame={statement.user.avatar_frame_style}
          name={statement.user.name}
          uri={statement.user.avatar_uri}
          vip={Boolean(statement.user.is_permanent_vip)}
        />
        <div className="square-statement-author-copy">
          <strong>{statement.user.name}</strong>
          <span>{formatStatementTime(statement.created_at, language)} · {statement.visibility === "friends" ? t("square.friendsOnly") : t("square.public")}</span>
        </div>
      </header>
      {statement.text ? <p className="square-statement-text">{statement.text}</p> : null}
      {images.length ? (
        <div className={`square-statement-images count-${Math.min(images.length, 9)}`}>
          {images.map((image, index) => (
            <button key={image.media_id} onClick={() => onOpenImage(index)} type="button">
              <img alt="" loading="lazy" src={image.thumbnail_uri || image.uri} />
              {image.location ? (
                <span className="square-photo-location"><span className="material-symbols-outlined">location_on</span>{image.location.address || t("square.photoLocation")}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {audio ? (
        <div className="square-statement-audio">
          <button onClick={() => {
            const player = audioRef.current;
            if (!player) return;
            if (player.paused) void player.play();
            else player.pause();
          }} type="button"><span className="material-symbols-outlined">{playing ? "pause" : "play_arrow"}</span></button>
          <div className="square-audio-wave" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
          <small>{audio.duration_seconds ? `${audio.duration_seconds}s` : t("square.voice")}</small>
          <audio hidden onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} preload="metadata" ref={audioRef} src={audio.uri} />
        </div>
      ) : null}
      <footer className="square-statement-footer">
        <button onClick={onOpenComments} type="button">
          <span className="material-symbols-outlined">chat_bubble</span>
          <span>{statement.comment_count ? t("square.commentsCount", { count: statement.comment_count }) : t("square.comment")}</span>
        </button>
      </footer>
    </article>
  );
}

export default function SquarePage() {
  const { t, language } = useI18n();
  const { session } = useAuth();
  const [statements, setStatements] = useState<SquareStatementDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoLocation, setPhotoLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [visibilitySheetOpen, setVisibilitySheetOpen] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const [gallery, setGallery] = useState<{ statementId: number; index: number } | null>(null);
  const [commentStatementId, setCommentStatementId] = useState<number | null>(null);
  const [comments, setComments] = useState<SquareStatementCommentDTO[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const canPublish = Boolean(session?.user.verified);
  const activeCommentStatement = statements.find((item) => item.statement_id === commentStatementId) ?? null;
  const galleryStatement = statements.find((item) => item.statement_id === gallery?.statementId) ?? null;
  const galleryImages = galleryStatement?.media.filter((item) => item.kind === "image") ?? [];

  const remaining = MAX_TEXT_LENGTH - text.length;
  const publishable = useMemo(
    () => Boolean(text.trim() || photos.length || voiceFile) && !publishing && text.length <= MAX_TEXT_LENGTH,
    [photos.length, publishing, text, voiceFile],
  );

  const loadStatements = async (before?: number) => {
    const controller = new AbortController();
    try {
      const rows = await api.getSquareStatements({ before, limit: 20 }, controller.signal);
      setStatements((current) => before ? [...current, ...rows] : rows);
      setHasMore(rows.length === 20);
      setError("");
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("square.loadFailed"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    return () => controller.abort();
  };

  useEffect(() => {
    const controller = new AbortController();
    void api.getSquareStatements({ limit: 20 }, controller.signal).then((rows) => {
      setStatements(rows);
      setHasMore(rows.length === 20);
      setError("");
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("square.loadFailed"));
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [t]);

  useEffect(() => () => {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
  }, []);

  useEffect(() => {
    if (commentStatementId === null) return;
    const controller = new AbortController();
    setCommentsLoading(true);
    void api.getSquareStatementComments(commentStatementId, { limit: 30 }, controller.signal).then((rows) => {
      setComments(rows);
      setCommentsHasMore(rows.length === 30);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("square.commentsLoadFailed"));
    }).finally(() => setCommentsLoading(false));
    return () => controller.abort();
  }, [commentStatementId, t]);

  const sendComment = async () => {
    const content = commentText.trim();
    if (commentStatementId === null || !content || commentSending) return;
    setCommentSending(true);
    try {
      const comment = await api.createSquareStatementComment(commentStatementId, content);
      setComments((current) => [comment, ...current]);
      setStatements((current) => current.map((statement) => statement.statement_id === commentStatementId
        ? { ...statement, comment_count: (statement.comment_count || 0) + 1 }
        : statement));
      setCommentText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("square.commentFailed"));
    } finally {
      setCommentSending(false);
    }
  };

  const choosePhotos = (files: FileList | null) => {
    if (!files) return;
    const available = MAX_PHOTOS - photos.length;
    const next = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, available).map((file) => ({
      id: `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((current) => [...current, ...next]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((photo) => photo.id !== id);
    });
  };

  const addPhotoLocation = () => {
    if (!navigator.geolocation) {
      setError(t("square.locationUnsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPhotoLocation({ latitude: coords.latitude, longitude: coords.longitude }),
      () => setError(t("square.locationFailed")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const stopRecording = () => recorderRef.current?.state === "recording" && recorderRef.current.stop();

  const startRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;
      recorderChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recorder.addEventListener("dataavailable", (event) => event.data.size && recorderChunksRef.current.push(event.data));
      recorder.addEventListener("stop", () => {
        const duration = Math.max(1, Math.min(MAX_AUDIO_SECONDS, Math.round((Date.now() - recordingStartedAtRef.current) / 1000)));
        const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setVoiceFile(new File([blob], `statement-${Date.now()}.webm`, { type: blob.type }));
        setVoiceDuration(duration);
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
      });
      recorder.start(250);
      setVoiceDuration(0);
      setRecording(true);
      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setVoiceDuration(elapsed);
        if (elapsed >= MAX_AUDIO_SECONDS) stopRecording();
      }, 500);
    } catch {
      setError(t("square.recordingFailed"));
    }
  };

  const publish = async () => {
    if (!publishable) return;
    setPublishing(true);
    setError("");
    const total = photos.length + (voiceFile ? 1 : 0);
    let completed = 0;
    try {
      const media: SquareStatementDraftMedia[] = [];
      for (const photo of photos) {
        const upload = await uploadMessageMediaWith(photo.file, "image", (kind, fileName, contentType) => api.createSquareUpload(kind as "image", fileName, contentType), (progress) => {
          setUploadProgress((completed + progress) / Math.max(1, total));
        });
        media.push({
          kind: "image",
          key: upload.key,
          mime_type: photo.file.type,
          location: photoLocation ?? undefined,
        });
        completed += 1;
      }
      if (voiceFile) {
        const upload = await uploadMessageMediaWith(voiceFile, "audio", (kind, fileName, contentType) => api.createSquareUpload(kind as "audio", fileName, contentType), (progress) => {
          setUploadProgress((completed + progress) / Math.max(1, total));
        });
        media.push({ kind: "audio", key: upload.key, mime_type: voiceFile.type, duration_seconds: voiceDuration });
      }
      const statement = await api.createSquareStatement({ text: text.trim(), visibility, media });
      setStatements((current) => [statement, ...current]);
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
      setText("");
      setPhotos([]);
      setVoiceFile(null);
      setVoiceDuration(0);
      setPhotoLocation(null);
      setVisibility("public");
      setComposerOpen(false);
    } catch (cause) {
      setError(toMessageUploadError(cause).message);
    } finally {
      setPublishing(false);
      setUploadProgress(0);
    }
  };

  return (
    <AppChrome title={t("square.title")} hideTopbar shellClassName="desktop-tab-shell square-community-shell">
      <main className="list-screen square-feed-screen">
        <TabPageHeader
          title={t("square.title")}
          status={canPublish ? (
            <button className="square-header-publish" onClick={() => setComposerOpen(true)} type="button">
              <span className="material-symbols-outlined">edit_square</span>
              <span>{t("square.publish")}</span>
            </button>
          ) : null}
        />
        <div className="square-feed-column">
          {canPublish ? (
            <button className="square-compose-launcher" onClick={() => setComposerOpen(true)} type="button">
              <UserAvatar className="square-composer-avatar" frame={session?.user.avatar_frame_style} name={session?.user.name || ""} uri={session?.user.avatar_uri} vip={Boolean(session?.user.is_permanent_vip)} />
              <span>{text.trim() || t("square.saySomething")}</span>
              <i><span className="material-symbols-outlined">image</span></i>
              <i><span className="material-symbols-outlined">mic</span></i>
            </button>
          ) : (
            <section className="square-readonly-notice">
              <span className="material-symbols-outlined">visibility</span>
              <div><strong>{t("square.readOnlyTitle")}</strong><p>{t("square.readOnlyHint")}</p></div>
            </section>
          )}
          {error ? <div className="square-inline-error">{error}</div> : null}
          {loading ? <FeedbackState title={t("common.loading")} /> : null}
          {!loading && !statements.length && !error ? <FeedbackState title={t("square.empty")} description={t("square.emptyHint")} /> : null}
          <section className="square-statement-feed">
            {statements.map((statement) => <StatementCard key={statement.statement_id} language={language} onOpenComments={() => setCommentStatementId(statement.statement_id)} onOpenImage={(index) => setGallery({ statementId: statement.statement_id, index })} statement={statement} />)}
          </section>
          {hasMore && statements.length ? (
            <button className="square-load-more" disabled={loadingMore} onClick={() => {
              setLoadingMore(true);
              void loadStatements(statements[statements.length - 1]?.statement_id);
            }} type="button">{loadingMore ? t("common.loading") : t("square.loadMore")}</button>
          ) : null}
        </div>
      </main>
      <SideDrawer
        actionBusy={publishing}
        actionDisabled={!publishable}
        actionLabel={t("square.publish")}
        historyKey="square-compose"
        onAction={() => void publish()}
        onClose={() => setComposerOpen(false)}
        open={composerOpen}
        title={t("square.composeTitle")}
      >
        <div className="square-compose-drawer">
          {error ? <div className="square-inline-error">{error}</div> : null}
          <div className="square-compose-editor">
            <UserAvatar className="square-composer-avatar" frame={session?.user.avatar_frame_style} name={session?.user.name || ""} uri={session?.user.avatar_uri} vip={Boolean(session?.user.is_permanent_vip)} />
            <div>
              <strong>{session?.user.name}</strong>
              <textarea autoFocus aria-label={t("square.saySomething")} maxLength={MAX_TEXT_LENGTH} onChange={(event) => setText(event.target.value)} placeholder={t("square.saySomething")} value={text} />
            </div>
          </div>
          {photos.length ? <div className="square-composer-photos">{photos.map((photo) => <button key={photo.id} onClick={() => removePhoto(photo.id)} type="button"><img alt="" src={photo.preview} /><span className="material-symbols-outlined">close</span></button>)}</div> : null}
          {voiceFile ? <div className="square-composer-voice"><span className="material-symbols-outlined">graphic_eq</span><strong>{t("square.voiceReady")}</strong><span>{voiceDuration}s</span><button onClick={() => { setVoiceFile(null); setVoiceDuration(0); }} type="button"><span className="material-symbols-outlined">close</span></button></div> : null}
          {publishing ? <div className="square-publish-progress"><i style={{ width: `${Math.round(uploadProgress * 100)}%` }} /></div> : null}
          <div className="square-compose-settings">
            <button onClick={() => setVisibilitySheetOpen(true)} type="button"><span className="material-symbols-outlined">{visibility === "friends" ? "group" : "public"}</span><div><strong>{t("square.visibility")}</strong><small>{visibility === "friends" ? t("square.friendsOnly") : t("square.public")}</small></div><span className="material-symbols-outlined">chevron_right</span></button>
            {photos.length ? <button onClick={() => setLocationSheetOpen(true)} type="button"><span className="material-symbols-outlined">location_on</span><div><strong>{t("square.addLocation")}</strong><small>{photoLocation ? t("square.locationAddedShort") : t("square.locationOptional")}</small></div><span className="material-symbols-outlined">chevron_right</span></button> : null}
          </div>
          <footer className="square-compose-dock">
            <input accept="image/*" hidden multiple onChange={(event) => choosePhotos(event.target.files)} ref={photoInputRef} type="file" />
            <button disabled={photos.length >= MAX_PHOTOS || publishing} onClick={() => photoInputRef.current?.click()} type="button"><span className="material-symbols-outlined">image</span><span>{t("square.photo")}</span></button>
            <button disabled={publishing} onClick={() => setVoiceSheetOpen(true)} type="button"><span className="material-symbols-outlined">mic</span><span>{t("square.voice")}</span></button>
            <span className={remaining < 20 ? "is-near-limit" : ""}>{remaining}</span>
          </footer>
        </div>
      </SideDrawer>
      <BottomSheet bodyClassName="square-choice-sheet" onClose={() => setVisibilitySheetOpen(false)} open={visibilitySheetOpen} title={t("square.visibility")}>
        {(["public", "friends"] as const).map((value) => <button className={visibility === value ? "is-selected" : ""} key={value} onClick={() => { setVisibility(value); setVisibilitySheetOpen(false); }} type="button"><span className="material-symbols-outlined">{value === "public" ? "public" : "group"}</span><div><strong>{value === "public" ? t("square.public") : t("square.friendsOnly")}</strong><small>{value === "public" ? t("square.publicHint") : t("square.friendsHint")}</small></div><span className="material-symbols-outlined">check</span></button>)}
      </BottomSheet>
      <BottomSheet bodyClassName="square-location-sheet" onClose={() => setLocationSheetOpen(false)} open={locationSheetOpen} title={t("square.addLocation")}>
        <div className="square-location-orbit"><span className="material-symbols-outlined">location_on</span><i /><i /></div>
        <p>{photoLocation ? t("square.locationAdded") : t("square.locationSheetHint")}</p>
        <button className="primary-button" onClick={() => { if (photoLocation) setPhotoLocation(null); else addPhotoLocation(); setLocationSheetOpen(false); }} type="button">{photoLocation ? t("square.removeLocation") : t("square.useCurrentLocation")}</button>
      </BottomSheet>
      <BottomSheet bodyClassName="square-voice-sheet" onClose={() => { if (recording) stopRecording(); setVoiceSheetOpen(false); }} open={voiceSheetOpen} title={t("square.voice")}>
        <div className={`square-voice-stage${recording ? " is-recording" : ""}`}><div className="square-voice-bars">{Array.from({ length: 25 }, (_, index) => <i key={index} />)}</div><strong>{Math.min(voiceDuration, MAX_AUDIO_SECONDS)}<small> / {MAX_AUDIO_SECONDS}s</small></strong></div>
        <button className="square-record-button" onClick={() => void startRecording()} type="button"><span className="material-symbols-outlined">{recording ? "stop" : "mic"}</span></button>
        <p>{recording ? t("square.tapToStop") : voiceFile ? t("square.voiceReady") : t("square.tapToRecord")}</p>
        {voiceFile && !recording ? <button className="primary-button" onClick={() => setVoiceSheetOpen(false)} type="button">{t("common.done")}</button> : null}
      </BottomSheet>
      <SideDrawer historyKey="square-comments" onClose={() => setCommentStatementId(null)} open={commentStatementId !== null} title={t("square.comments")}>
        <div className="square-comments-drawer">
          {activeCommentStatement ? <div className="square-comments-context"><UserAvatar className="square-comment-avatar" frame={activeCommentStatement.user.avatar_frame_style} name={activeCommentStatement.user.name} uri={activeCommentStatement.user.avatar_uri} vip={Boolean(activeCommentStatement.user.is_permanent_vip)} /><div><strong>{activeCommentStatement.user.name}</strong><p>{activeCommentStatement.text || t("square.mediaStatement")}</p></div></div> : null}
          {commentsLoading && !comments.length ? <FeedbackState title={t("common.loading")} /> : null}
          {!commentsLoading && !comments.length ? <div className="square-comments-empty"><span className="material-symbols-outlined">forum</span><strong>{t("square.noComments")}</strong><p>{canPublish ? t("square.noCommentsHint") : t("square.readOnlyHint")}</p></div> : null}
          <div className="square-comment-list">{comments.map((comment) => <article key={comment.comment_id}><UserAvatar className="square-comment-avatar" frame={comment.user.avatar_frame_style} name={comment.user.name} uri={comment.user.avatar_uri} vip={Boolean(comment.user.is_permanent_vip)} /><div><header><strong>{comment.user.name}</strong><span>{formatStatementTime(comment.created_at, language)}</span></header><p>{comment.text}</p></div></article>)}</div>
          {commentsHasMore ? <button className="square-load-more" disabled={commentsLoading} onClick={() => {
            const before = comments[comments.length - 1]?.comment_id;
            if (!before || commentStatementId === null) return;
            setCommentsLoading(true);
            void api.getSquareStatementComments(commentStatementId, { before, limit: 30 }).then((rows) => { setComments((current) => [...current, ...rows]); setCommentsHasMore(rows.length === 30); }).finally(() => setCommentsLoading(false));
          }} type="button">{t("square.loadMoreComments")}</button> : null}
          {canPublish ? <form className="square-comment-composer" onSubmit={(event) => { event.preventDefault(); void sendComment(); }}><UserAvatar className="square-comment-avatar" name={session?.user.name || ""} uri={session?.user.avatar_uri} /><input aria-label={t("square.writeComment")} maxLength={MAX_TEXT_LENGTH} onChange={(event) => setCommentText(event.target.value)} placeholder={t("square.writeComment")} value={commentText} /><button disabled={!commentText.trim() || commentSending} type="submit"><span className="material-symbols-outlined">arrow_upward</span></button></form> : null}
        </div>
      </SideDrawer>
      {gallery && galleryImages.length ? <ImageLightbox altPrefix={t("square.photo")} index={gallery.index} onClose={() => setGallery(null)} onIndexChange={(index) => setGallery((current) => current ? { ...current, index } : null)} uris={galleryImages.map((image) => image.uri)} /> : null}
    </AppChrome>
  );
}
