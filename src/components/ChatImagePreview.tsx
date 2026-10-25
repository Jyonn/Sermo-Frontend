import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { mergeChatImages, readNewerChatImagePage, type ChatPreviewImage } from "../lib/chatImageHistory";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import { MediaLightbox } from "./ImageLightbox";
import type { ChatMessageDTO, ImageMetadataDTO } from "../types";

export function ChatImagePreview({ images, initialIndex, chatId, onClose }: {
  images: ChatPreviewImage[];
  initialIndex: number;
  chatId?: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [gallery, setGallery] = useState({ items: images, index: initialIndex });
  const galleryRef = useRef(gallery);
  galleryRef.current = gallery;
  const original = useRef(new Set(images.map((image) => image.messageId === null ? image.uri : image.messageId)));
  const inside = useRef(true);
  const ids = images.flatMap((image) => image.messageId === null ? [] : [image.messageId]);
  const cursors = useRef({ older: Math.min(...ids), newer: Math.max(...ids) });
  const controllers = useRef<Partial<Record<"older" | "newer", AbortController>>>({});
  const failed = useRef({ older: false, newer: false });
  const [pending, setPending] = useState({ older: false, newer: false });
  const [more, setMore] = useState({ older: Boolean(chatId && ids.length), newer: Boolean(chatId && ids.length) });
  const moreRef = useRef(more);
  moreRef.current = more;
  const isOriginal = (image: ChatPreviewImage) => original.current.has(image.messageId === null ? image.uri : image.messageId);
  const notifyCollection = (image: ChatPreviewImage) => {
    const next = isOriginal(image);
    if (next !== inside.current) showToast(t(next ? "media.backToCollection" : "media.outsideCollection"), "info", 3000);
    inside.current = next;
  };
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
        const result = await api.searchMessages({ chat_id: chatId, type: 1, before: cursors.current.older, limit: 30 }, controller.signal);
        rows = result.items;
        hasMore = result.has_more;
        if (rows.length) cursors.current.older = Math.min(...rows.map((row) => row.message_id));
      } else {
        // The compact message endpoint supplies forward pagination; skip text-only pages.
        const result = await readNewerChatImagePage(cursors.current.newer,
          (after) => api.getMessages({ chat_id: chatId, after, limit: 100 }, controller.signal), controller.signal);
        rows = result.rows;
        hasMore = result.hasMore;
        cursors.current.newer = result.after;
      }
      if (controller.signal.aborted) return;
      const incoming = rows.filter((row) => row.type === 1 && row.payload?.uri).sort((a, b) => a.message_id - b.message_id).map((row) => ({
        uri: row.payload!.uri!, messageId: row.message_id, metadata: row.payload?.image_metadata, posterUri: row.payload?.thumbnail_uri,
      }));
      const current = galleryRef.current;
      const next = mergeChatImages(current.items, incoming, current.index, direction);
      if (advance && incoming.length) next.index = Math.max(0, Math.min(next.items.length - 1, next.index + (direction === "older" ? -1 : 1)));
      if (advance && next.items[next.index]) notifyCollection(next.items[next.index]);
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
  useEffect(() => {
    const id = active?.messageId;
    if (!id || active.metadata?.status === 2 || active.metadata?.status === 1 && active.metadata.geocoding_status !== 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void api.getMediaMetadata<ImageMetadataDTO>(id, controller.signal).then((metadata) => {
        if (!controller.signal.aborted) setGallery((value) => ({ ...value, items: value.items.map((image) => image.messageId === id ? { ...image, metadata } : image) }));
      }).catch(() => undefined);
    }, 1200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [active?.messageId, active?.metadata]);
  const collectionIndex = images.findIndex((image) => image.messageId === null ? image.uri === active?.uri : image.messageId === active?.messageId);
  return <MediaLightbox index={gallery.index} items={gallery.items.map((image) => ({
    id: image.messageId ?? image.uri, uri: image.uri, kind: "image", posterUri: image.posterUri, imageMetadata: image.metadata,
    downloadLabel: image.metadata?.file_size ? image.metadata.file_size >= 1048576 ? `${(image.metadata.file_size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(image.metadata.file_size / 1024))} KB` : undefined,
  }))} onClose={onClose} onIndexChange={(index) => {
    if (!gallery.items[index]) return;
    notifyCollection(gallery.items[index]);
    setGallery((value) => ({ ...value, index }));
  }} onApproachingStart={() => void load("older")} onApproachingEnd={() => void load("newer")}
    hasPrevious={more.older} hasNext={more.newer} loading={pending.older || pending.newer}
    onBoundary={(direction) => void load(direction, true)}
    navigationLabel={collectionIndex >= 0 ? t("media.collectionPosition", { index: collectionIndex + 1, count: images.length }) : t("media.chatPhotos")} />;
}
