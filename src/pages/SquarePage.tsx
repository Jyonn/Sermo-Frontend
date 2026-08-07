import { useEffect, useMemo, useRef, useState } from "react";
import { AppChrome } from "../components/AppChrome";
import { FeedbackState } from "../components/FeedbackState";
import { TabPageHeader } from "../components/TabPageHeader";
import { UserAvatar } from "../components/UserAvatar";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { toMessageUploadError, uploadMessageMediaWith } from "../lib/messageUpload";
import type { SquareStatementDTO, SquareStatementDraftMedia } from "../types";

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

function StatementCard({ statement, language }: { statement: SquareStatementDTO; language: string }) {
  const { t } = useI18n();
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
        <div>
          <strong>{statement.user.name}</strong>
          <span>{formatStatementTime(statement.created_at, language)}</span>
        </div>
        {statement.visibility === "friends" ? (
          <span className="square-visibility-badge"><span className="material-symbols-outlined">group</span>{t("square.friendsOnly")}</span>
        ) : null}
      </header>
      {statement.text ? <p className="square-statement-text">{statement.text}</p> : null}
      {images.length ? (
        <div className={`square-statement-images count-${Math.min(images.length, 9)}`}>
          {images.map((image) => (
            <figure key={image.media_id}>
              <img alt="" loading="lazy" src={image.thumbnail_uri || image.uri} />
              {image.location ? (
                <figcaption><span className="material-symbols-outlined">location_on</span>{image.location.address || t("square.photoLocation")}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
      {audio ? (
        <div className="square-statement-audio">
          <span className="material-symbols-outlined">graphic_eq</span>
          <audio controls preload="metadata" src={audio.uri} />
          <small>{audio.duration_seconds ? `${audio.duration_seconds}s` : t("square.voice")}</small>
        </div>
      ) : null}
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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const canPublish = Boolean(session?.user.verified);

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
    } catch (cause) {
      setError(toMessageUploadError(cause).message);
    } finally {
      setPublishing(false);
      setUploadProgress(0);
    }
  };

  return (
    <AppChrome title={t("square.title")} shellClassName="desktop-tab-shell square-community-shell">
      <main className="list-screen square-feed-screen">
        <TabPageHeader title={t("square.title")} />
        <div className="square-feed-column">
          {canPublish ? (
            <section className="square-composer">
              <div className="square-composer-main">
                <UserAvatar className="square-composer-avatar" name={session?.user.name || ""} uri={session?.user.avatar_uri} />
                <textarea
                  aria-label={t("square.saySomething")}
                  maxLength={MAX_TEXT_LENGTH}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={t("square.saySomething")}
                  value={text}
                />
              </div>
              {photos.length ? (
                <div className="square-composer-photos">
                  {photos.map((photo) => (
                    <button key={photo.id} onClick={() => removePhoto(photo.id)} type="button">
                      <img alt="" src={photo.preview} />
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {voiceFile || recording ? (
                <div className={`square-composer-voice${recording ? " is-recording" : ""}`}>
                  <span className="material-symbols-outlined">graphic_eq</span>
                  <strong>{recording ? t("square.recording") : t("square.voiceReady")}</strong>
                  <span>{Math.min(voiceDuration, MAX_AUDIO_SECONDS)}s</span>
                  {!recording ? <button onClick={() => { setVoiceFile(null); setVoiceDuration(0); }} type="button"><span className="material-symbols-outlined">close</span></button> : null}
                </div>
              ) : null}
              {photoLocation && photos.length ? <p className="square-composer-location"><span className="material-symbols-outlined">location_on</span>{t("square.locationAdded")}</p> : null}
              {publishing ? <div className="square-publish-progress"><i style={{ width: `${Math.round(uploadProgress * 100)}%` }} /></div> : null}
              <footer className="square-composer-actions">
                <div>
                  <input accept="image/*" hidden multiple onChange={(event) => choosePhotos(event.target.files)} ref={photoInputRef} type="file" />
                  <button disabled={photos.length >= MAX_PHOTOS || publishing} onClick={() => photoInputRef.current?.click()} type="button"><span className="material-symbols-outlined">image</span>{t("square.photo")}</button>
                  <button disabled={!photos.length || publishing} onClick={addPhotoLocation} type="button"><span className="material-symbols-outlined">location_on</span>{t("square.addLocation")}</button>
                  <button disabled={publishing} onClick={() => void startRecording()} type="button"><span className="material-symbols-outlined">mic</span>{recording ? t("square.stop") : t("square.voice")}</button>
                </div>
                <div className="square-composer-publish">
                  <button className="square-visibility-control" onClick={() => setVisibility((current) => current === "public" ? "friends" : "public")} type="button">
                    <span className="material-symbols-outlined">{visibility === "friends" ? "group" : "public"}</span>
                    {visibility === "friends" ? t("square.friendsOnly") : t("square.public")}
                  </button>
                  <span className={remaining < 20 ? "is-near-limit" : ""}>{remaining}</span>
                  <button className="primary-button" disabled={!publishable} onClick={() => void publish()} type="button">{publishing ? t("square.publishing") : t("square.publish")}</button>
                </div>
              </footer>
            </section>
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
            {statements.map((statement) => <StatementCard key={statement.statement_id} language={language} statement={statement} />)}
          </section>
          {hasMore && statements.length ? (
            <button className="square-load-more" disabled={loadingMore} onClick={() => {
              setLoadingMore(true);
              void loadStatements(statements[statements.length - 1]?.statement_id);
            }} type="button">{loadingMore ? t("common.loading") : t("square.loadMore")}</button>
          ) : null}
        </div>
      </main>
    </AppChrome>
  );
}
