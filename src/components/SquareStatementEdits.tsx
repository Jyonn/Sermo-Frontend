import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { diffSquareRevisionText } from "../lib/squareRevisionText";
import { ChatPreview, forwardBundleItemsAsMessages } from "../pages/ChatsPage";
import type { ImageMetadataDTO, InlineEmoticonDTO, SquareStatementRevision, VideoMetadataDTO } from "../types";
import { ContentLoader } from "./BoundaryState";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { SideDrawer } from "./SideDrawer";
import { SquareStatementAudio } from "./SquareStatementAudio";
import { StatementVideoThumbnail } from "./StatementVideoThumbnail";
import "./SquareStatementEdits.css";

export function SquareEditedLabel({ onHistory }: { onHistory: () => void }) {
  const { t } = useI18n();
  return <button className="square-edited-label" type="button" aria-label={t("square.editHistory")}
    onKeyDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onHistory(); }}>
    {t("square.edited")}
  </button>;
}

type HistoryContentProps = {
  renderText: (text: string, emoticons?: InlineEmoticonDTO[]) => ReactNode;
  onOpenImages: (uris: string[], index: number, metadata?: Array<ImageMetadataDTO | null>) => void;
  onOpenVideo: (uri: string, metadata: VideoMetadataDTO | null) => void;
};

function HistoryVersion({ row, previous, renderText, onOpenImages, onOpenVideo }: HistoryContentProps & {
  row: SquareStatementRevision;
  previous?: SquareStatementRevision;
}) {
  const { t } = useI18n();
  const diff = previous && diffSquareRevisionText(previous.text, row.text);
  const changes = new Set(previous?.changes);
  const previousMediaIds = new Set(previous?.media?.map(item => item.media_id));
  const currentMediaIds = new Set(row.media?.map(item => item.media_id));
  const retainedBefore = [...previousMediaIds].filter(id => currentMediaIds.has(id));
  const retainedNow = [...currentMediaIds].filter(id => previousMediaIds.has(id));
  const removedFields = (["media", "external_media", "chat_record", "location"] as const).filter(field => {
    if (!changes.has(field) || row.unavailable_fields?.includes(field)) return false;
    if (field !== "media") return Boolean(previous?.[field] && !row[field]);
    return previous?.media?.some(item => !currentMediaIds.has(item.media_id));
  });
  const images = row.media?.filter(item => item.kind === "image") ?? [];
  const audio = row.media?.find(item => item.kind === "audio");
  const video = row.media?.find(item => item.kind === "video");
  const record = row.chat_record;
  const mediaChanged = (mediaId: number) =>
    changes.has("media") && (!previousMediaIds.has(mediaId) || retainedBefore.indexOf(mediaId) !== retainedNow.indexOf(mediaId));
  const fieldClass = (changed: boolean) => changed ? "square-history-field is-changed" : "square-history-field";
  const preview = row.external_media;

  return <>
    {row.text ? <p className="square-history-text">{diff ? diff.parts.map((part, index) => {
      const content = renderText(part.text, row.inline_emoticons);
      return part.changed ? <mark key={index}>{content}</mark> : <Fragment key={index}>{content}</Fragment>;
    }) : renderText(row.text, row.inline_emoticons)}</p> : null}
    {diff && diff.removed.length > 0 ? <small className="square-history-note">
      {t("square.historyDeletedText")}{" "}
      {diff.removed.map((part, index) => <Fragment key={index}>{index > 0 && " · "}<del>{renderText(part, previous?.inline_emoticons)}</del></Fragment>)}
    </small> : null}
    {preview ? <div className={fieldClass(changes.has("external_media"))}>
      <LinkPreviewCard preview={preview.status === "pending" ? { ...preview, status: "failed" } : preview} />
    </div> : null}
    {record?.items?.length ? <div className={fieldClass(changes.has("chat_record"))}>
      <ChatPreview backgroundTheme="default" className="square-chat-record-preview" showSelfAuthors
        firstPersonUserId={record.first_person_user_id} wheelScrollMode="parent"
        messages={forwardBundleItemsAsMessages(record.items).map(message => record.redacted_identity && message.user.anonymous
          ? { ...message, user: { ...message.user, name: t("message.redactedParticipant", { number: message.user.name }) } }
          : message)}
        onOpenImage={onOpenImages} onOpenVideo={onOpenVideo} />
    </div> : null}
    {images.length > 0 ? <div className={`square-statement-images square-history-images count-${Math.min(images.length, 9)}`}>
      {images.map((item, index) => <button key={item.media_id} type="button" className={mediaChanged(item.media_id) ? "is-changed" : undefined}
        aria-label={t("media.imagePreview")} onClick={() => onOpenImages(images.map(image => image.uri), index,
          images.map(image => image.metadata as ImageMetadataDTO | null ?? null))}>
        <img src={item.thumbnail_uri || item.uri} alt="" loading="lazy" />
      </button>)}
    </div> : null}
    {audio ? <div className={fieldClass(mediaChanged(audio.media_id))}><SquareStatementAudio audio={audio} preload="none" /></div> : null}
    {video ? <div className={fieldClass(mediaChanged(video.media_id))}>
      <StatementVideoThumbnail className="square-statement-video" durationSeconds={video.duration_seconds}
        onClick={() => onOpenVideo(video.uri, video.metadata as VideoMetadataDTO | null ?? null)} thumbnailUri={video.thumbnail_uri} />
    </div> : null}
    {row.location ? <div className={`square-history-detail ${fieldClass(changes.has("location"))}`}>
      <span className="material-symbols-outlined" aria-hidden="true">location_on</span>
      {row.location.address || `${row.location.latitude.toFixed(4)}, ${row.location.longitude.toFixed(4)}`}
    </div> : null}
    {row.visibility ? <div className={`square-history-detail ${fieldClass(changes.has("visibility"))}`}>
      <span className="material-symbols-outlined" aria-hidden="true">{row.visibility === "friends" ? "group" : "public"}</span>
      {t(row.visibility === "friends" ? "square.friendsOnly" : "square.public")}
    </div> : null}
    {removedFields.length > 0 ? <small className="square-history-note">
      {t("square.historyRemovedFields", { fields: removedFields.map(field => t(`square.editField.${field}`)).join(" · ") })}
    </small> : null}
    {row.unavailable_fields?.length ? <small className="square-history-note">
      {t("square.historyUnavailableFields", { fields: row.unavailable_fields.map(field => t(`square.editField.${field}`)).join(" · ") })}
    </small> : null}
  </>;
}

export function SquareStatementHistory({ statementId, onClose, ...content }: HistoryContentProps & {
  statementId: number;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const [rows, setRows] = useState<SquareStatementRevision[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const date = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });

  function load(before?: number) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    api.getSquareStatementHistory(statementId, before, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setRows(previous => before === undefined ? result.items : [...previous, ...result.items]);
      setNext(result.next_before);
    }).catch(e => {
      if (!controller.signal.aborted) setError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
  }

  useEffect(() => {
    load();
    return () => request.current?.abort();
  }, [statementId]);

  return <SideDrawer open showTitle className="square-statement-history" historyKey="square-statement-history" title={t("square.editHistory")} onClose={onClose}>
    {loading && !rows.length && <ContentLoader label={t("common.loading")} rows={3} />}
    <ol className="square-history-list">
      {rows.map((row, index) => <li key={row.revision}>
        <header><strong>{t(index === 0 ? "square.latestEdit" : row.revision === 0 ? "square.originalEdit" : "square.previousEdit")}</strong>
          <time dateTime={new Date(row.published_at * 1000).toISOString()}>{date.format(row.published_at * 1000)}</time></header>
        <HistoryVersion {...content} row={row} previous={rows[index + 1]?.revision === row.revision - 1 ? rows[index + 1] : undefined} />
      </li>)}
    </ol>
    {error && <p className="square-inline-error" role="alert">{error}</p>}
    {(error || next !== null) && <button className="ghost-button" type="button" disabled={loading} onClick={() => load(next ?? undefined)}>
      {t(error ? "common.retry" : "common.loadMore")}
    </button>}
  </SideDrawer>;
}
