import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { isChatHistoryMedia, mergeChatImages, readNewerChatImagePage, readOlderChatMediaPage, type ChatPreviewImage } from "../lib/chatImageHistory";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import { MediaLightbox } from "./ImageLightbox";
import type { ChatMessageDTO, ImageMetadataDTO, VideoMetadataDTO } from "../types";
import { MediaMetadataPanel } from "./MediaMetadataPanel";

export function ChatImagePreview({ images, initialIndex, chatId, originalIds, onClose, onJumpToMessage, onForwardMessage, onReplyMessage }: {
  images: ChatPreviewImage[];
  initialIndex: number;
  chatId?: number;
  originalIds?: Array<string | number>;
  onClose: () => void;
  onJumpToMessage?: (messageId: number) => void;
  onForwardMessage?: (message: ChatMessageDTO) => void;
  onReplyMessage?: (message: ChatMessageDTO) => void;
}) {
  const { t } = useI18n();
  const [gallery, setGallery] = useState({ items: images, index: initialIndex });
  const galleryRef = useRef(gallery);
  galleryRef.current = gallery;
  const original = useRef(new Set(originalIds ?? images.map(image => image.messageId ?? image.uri)));
  const ids = images.flatMap((image) => image.messageId === null ? [] : [image.messageId]);
  const cursors = useRef({ older: Math.min(...ids), newer: Math.max(...ids) });
  const controllers = useRef<Partial<Record<"older" | "newer", AbortController>>>({});
  const failed = useRef({ older: false, newer: false });
  const [pending, setPending] = useState({ older: false, newer: false });
  const [more, setMore] = useState({ older: Boolean(chatId && ids.length), newer: Boolean(chatId && ids.length) });
  const moreRef = useRef(more);
  moreRef.current = more;
  const load = async (direction: "older" | "newer", advance = false) => {
    if (!chatId || !moreRef.current[direction] || controllers.current[direction] || failed.current[direction] && !advance) return;
    failed.current[direction] = false;
    const controller = new AbortController();
    controllers.current[direction] = controller;
    setPending((value) => ({ ...value, [direction]: true }));
    try {
      let rows: ChatMessageDTO[];
      let hasMore: boolean;
      if (direction === "older") {
        const before = cursors.current.older;
        const result = await readOlderChatMediaPage(before,
          type => api.searchMessages({ chat_id: chatId, type, before, limit: 30 }, controller.signal));
        rows = result.rows;
        hasMore = result.hasMore;
        cursors.current.older = result.before;
      } else {
        // The compact message endpoint supplies forward pagination; skip text-only pages.
        const result = await readNewerChatImagePage(cursors.current.newer,
          (after) => api.getMessages({ chat_id: chatId, after, limit: 100 }, controller.signal), controller.signal);
        rows = result.rows;
        hasMore = result.hasMore;
        cursors.current.newer = result.after;
      }
      if (controller.signal.aborted) return;
      const incoming: ChatPreviewImage[] = rows.filter(isChatHistoryMedia).sort((a, b) => a.message_id - b.message_id).map(row => ({
        uri: row.payload!.uri!, messageId: row.message_id, sourceMessage: row, kind: row.type === 4 ? "video" : "image",
        metadata: row.type === 4 ? row.payload?.video_metadata : row.payload?.image_metadata,
        posterUri: row.payload?.thumbnail_uri, owner: row.user, createdAt: row.created_at,
      }));
      const current = galleryRef.current;
      const next = mergeChatImages(current.items, incoming, current.index, direction);
      if (advance && incoming.length) next.index = Math.max(0, Math.min(next.items.length - 1, next.index + (direction === "older" ? -1 : 1)));
      galleryRef.current = next;
      setGallery(next);
      moreRef.current = { ...moreRef.current, [direction]: hasMore };
      setMore(moreRef.current);
    } catch {
      if (!controller.signal.aborted) { failed.current[direction] = true; showToast(t("media.historyLoadFailed"), "error"); }
    } finally {
      delete controllers.current[direction];
      if (!controller.signal.aborted) setPending((value) => ({ ...value, [direction]: false }));
    }
  };
  useEffect(() => () => { Object.values(controllers.current).forEach((controller) => controller?.abort()); }, []);
  const active = gallery.items[gallery.index];
  const source = active?.sourceMessage;
  useEffect(() => {
    const id = active?.messageId;
    if (!id || active.metadata?.status === 2 || active.metadata?.status === 1 && active.metadata.geocoding_status !== 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void api.getMediaMetadata<ImageMetadataDTO | VideoMetadataDTO>(id, controller.signal).then((metadata) => {
        if (!controller.signal.aborted) setGallery((value) => ({ ...value, items: value.items.map((image) => image.messageId === id ? { ...image, metadata } : image) }));
      }).catch(() => undefined);
    }, 1200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [active?.messageId, active?.metadata]);
  const collection = [...original.current];
  const collectionIndex = active ? collection.indexOf(active.messageId ?? active.uri) : -1;
  return <MediaLightbox index={gallery.index} items={gallery.items.map((image) => ({
    id: image.messageId ?? image.uri, uri: image.uri, kind: image.kind ?? "image", posterUri: image.posterUri,
    imageMetadata: image.kind !== "video" ? image.metadata : undefined, owner: image.owner, createdAt: image.createdAt,
    width: image.metadata?.pixel_width, height: image.metadata?.pixel_height,
    detail: image.kind === "video" && image.metadata?.status === 1
      ? <MediaMetadataPanel kind="video" metadata={image.metadata} owner={image.owner} /> : undefined,
    downloadLabel: image.metadata?.file_size ? image.metadata.file_size >= 1048576 ? `${(image.metadata.file_size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(image.metadata.file_size / 1024))} KB` : undefined,
  }))} onClose={onClose} onIndexChange={(index) => {
    if (!gallery.items[index]) return;
    setGallery((value) => ({ ...value, index }));
  }} onApproachingStart={() => void load("older")} onApproachingEnd={() => void load("newer")}
    hasPrevious={more.older} hasNext={more.newer} loading={pending.older || pending.newer}
    onBoundary={(direction) => void load(direction, true)}
    onJumpToMessage={active?.messageId && onJumpToMessage ? () => onJumpToMessage(active.messageId!) : undefined}
    chatPreview
    onForward={source && !source.is_deleted && onForwardMessage ? () => onForwardMessage(source) : undefined}
    onReply={source && !source.is_deleted && onReplyMessage ? () => onReplyMessage(source) : undefined}
    navigationLabel={`${collectionIndex >= 0 ? collectionIndex + 1 : gallery.index + 1} / ${collectionIndex >= 0 ? collection.length : gallery.items.length}`} />;
}
