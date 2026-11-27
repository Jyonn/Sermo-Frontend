import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { useModalFocus } from "../lib/modalFocus";
import { showToast } from "../lib/toast";
import type { ChatDTO, ChatMessageDTO, ChatMessagePayloadDTO, ImageMetadataDTO, TinyUserDTO, VideoMetadataDTO } from "../types";
import { ChatPreview, forwardBundleItemsAsMessages } from "../pages/ChatsPage";
import { MediaLightbox, type MediaLightboxItem } from "./ImageLightbox";
import { SideDrawer } from "./SideDrawer";
import { TravelMapDrawer } from "./TravelMapDrawer";

interface AuditMenu {
  message: ChatMessageDTO;
  delivery: ChatMessageDTO | undefined;
  x: number;
  y: number;
  above: boolean;
}

interface AuditMedia {
  items: MediaLightboxItem[];
  index: number;
  flash?: boolean;
}

interface AuditLocation {
  location: { latitude: number; longitude: number; address?: string };
  owner: TinyUserDTO;
}

export function PlatformAuditConversation({ chat, firstPersonUserId, memberName, reason, hasMore, loading, messages, onLoadOlder, onInspectDelivery }: {
  chat: ChatDTO; firstPersonUserId: number | null; memberName?: string; reason: string; hasMore: boolean; loading: boolean;
  messages: ChatMessageDTO[]; onLoadOlder: () => Promise<void>; onInspectDelivery: (message: ChatMessageDTO) => void;
}) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const menuLayer = useRef<HTMLDivElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const flashRequest = useRef<AbortController>();
  const flashUrl = useRef("");
  const [menu, setMenu] = useState<AuditMenu | null>(null);
  const [media, setMedia] = useState<AuditMedia | null>(null);
  const [bundle, setBundle] = useState<ChatMessagePayloadDTO | null>(null);
  const [location, setLocation] = useState<AuditLocation | null>(null);
  const bundleMessages = useMemo(() => forwardBundleItemsAsMessages(bundle?.items ?? []), [bundle]);
  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const releaseFlash = () => {
    flashRequest.current?.abort();
    flashRequest.current = undefined;
    if (flashUrl.current) URL.revokeObjectURL(flashUrl.current);
    flashUrl.current = "";
  };
  const closeMedia = () => {
    releaseFlash();
    setMedia(null);
  };

  useModalFocus(menuLayer, Boolean(menu), () => setMenu(null));
  useLayoutEffect(() => {
    const panel = menuPanel.current;
    if (!menu || !panel) return;
    panel.style.setProperty("--message-menu-shift-x", "0px");
    panel.style.setProperty("--message-menu-shift-y", "0px");
    const rect = panel.getBoundingClientRect();
    const shiftX = Math.max(12 - rect.left, Math.min(0, window.innerWidth - 12 - rect.right));
    const shiftY = Math.max(12 - rect.top, Math.min(0, window.innerHeight - 12 - rect.bottom));
    panel.style.setProperty("--message-menu-shift-x", `${shiftX}px`);
    panel.style.setProperty("--message-menu-shift-y", `${shiftY}px`);
    const close = () => setMenu(null);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [menu]);

  useEffect(() => {
    const showBundle = (event: Event) => setBundle((event as CustomEvent<ChatMessagePayloadDTO>).detail);
    const showLocation = (event: Event) => setLocation((event as CustomEvent<AuditLocation>).detail);
    window.addEventListener("sermo:forward-bundle", showBundle);
    window.addEventListener("sermo:location-message", showLocation);
    return () => {
      releaseFlash();
      window.removeEventListener("sermo:forward-bundle", showBundle);
      window.removeEventListener("sermo:location-message", showLocation);
    };
  }, []);

  useLayoutEffect(() => { const node = scrollRef.current; if (node) node.scrollTop = node.scrollHeight; }, [chat.chat_id]);
  const loadOlder = async () => {
    const node = scrollRef.current;
    if (!node || !hasMore || loading || loadingRef.current) return;
    loadingRef.current = true;
    const previousHeight = node.scrollHeight;
    const previousTop = node.scrollTop;
    try {
      await onLoadOlder();
      requestAnimationFrame(() => { if (node.isConnected) node.scrollTop = previousTop + node.scrollHeight - previousHeight; });
    } finally { loadingRef.current = false; }
  };

  const openMenu = (message: ChatMessageDTO, anchor: HTMLElement, pointerX?: number) => {
    const delivery = message.message_id > 0 ? message : messages.find(row => row.message_id === bundle?.delivery_message_id);
    if (!delivery && !message.payload?.flash_audit_available) return;
    const rect = anchor.getBoundingClientRect();
    const above = rect.top > 100 || rect.top > window.innerHeight - rect.bottom;
    setMenu({message, delivery, x: pointerX || rect.left + rect.width / 2,
      y: above ? rect.top - 10 : rect.bottom + 10, above});
  };

  const findMediaMessage = (id?: number | null) => (id && id < 0 ? bundleMessages : messages).find(row => row.message_id === id);
  const openImages = (uris: string[], index: number, metadata: Array<ImageMetadataDTO | null> = [], ids: Array<number | null> = []) => {
    setMedia({index, items: uris.map((uri, position) => {
      const row = findMediaMessage(ids[position]);
      return {id: row?.message_id, kind: "image", uri, imageMetadata: metadata[position], owner: row?.user,
        createdAt: row?.created_at, thumbnailUri: row?.payload?.thumbnail_uri};
    })});
  };
  const openVideo = (uri: string, metadata: VideoMetadataDTO | null, id: number | null) => {
    const row = findMediaMessage(id);
    setMedia({index: 0, items: [{id: row?.message_id, kind: "video", uri, posterUri: row?.payload?.thumbnail_uri,
      width: metadata?.pixel_width, height: metadata?.pixel_height, owner: row?.user, createdAt: row?.created_at, autoPlay: true}]});
  };
  const openFlash = async (message: ChatMessageDTO) => {
    const id = message.payload?.flash_message_id;
    if (!id || !message.payload?.flash_audit_available) return;
    releaseFlash();
    const controller = new AbortController();
    flashRequest.current = controller;
    const item: MediaLightboxItem = {id, uri: "", kind: "image", owner: message.user, createdAt: message.created_at};
    setMedia({index: 0, items: [item], flash: true});
    try {
      const blob = await api.getPlatformFlashImage(chat.chat_id, id, reason, message.payload.flash_position ?? -1, controller.signal);
      if (controller.signal.aborted) return;
      flashUrl.current = URL.createObjectURL(blob);
      setMedia({index: 0, items: [{...item, uri: flashUrl.current}], flash: true});
    } catch {
      if (controller.signal.aborted) return;
      closeMedia();
      showToast(t("photo.flashFailed"), "error");
    }
  };

  const previewProps = { auditPreview: true, onMessageAction: openMenu, onOpenImage: openImages, onOpenVideo: openVideo };
  return <div className="platform-audit-workspace">
    <header className="platform-audit-context"><div><span className="platform-audit-readonly"><span aria-hidden="true" className="material-symbols-outlined">visibility</span>{t("management.readOnlyAudit")}</span>{memberName ? <span className="platform-audit-perspective">{t("management.memberPerspective", { name: memberName })}</span> : null}</div><p><strong>{t("management.auditReason")}</strong>{reason}</p></header>
    <div className="platform-conversation" onScroll={(event) => { if (event.currentTarget.scrollTop < 64) void loadOlder(); }} ref={scrollRef}>
      <div className="platform-audit-message-surface">
        {hasMore ? <button className="platform-audit-load-older" disabled={loading} onClick={() => void loadOlder()} type="button">{t(loading ? "common.loading" : "management.loadOlder")}</button> : <p className="platform-audit-boundary">{t("management.historyStart")}</p>}
        <ChatPreview {...previewProps} bare className="platform-audit-chat-preview" firstPersonUserId={firstPersonUserId} messages={orderedMessages} wheelScrollMode="parent" />
      </div>
    </div>
    <footer className="platform-audit-hint"><span aria-hidden="true" className="material-symbols-outlined">account_tree</span>{t("management.inspectDelivery")}</footer>
    <SideDrawer historyKey="platform-audit-bundle" className="forward-bundle-drawer" open={Boolean(bundle)}
      title={t("message.forwardBundleSnapshot")} onClose={() => setBundle(null)}>
      {bundle && <ChatPreview {...previewProps} messages={bundleMessages} className="forward-bundle-chat-preview"
        firstPersonUserId={bundle.first_person_user_id} showSelfAuthors />}
    </SideDrawer>
    <TravelMapDrawer historyKey="platform-audit-location" open={Boolean(location)} focusLocation={location?.location}
      focusOwner={location?.owner} onClose={() => setLocation(null)} />
    {menu && createPortal(
      <div className="message-context-layer" ref={menuLayer}
        onPointerDown={event => { if (event.target === event.currentTarget) setMenu(null); }}>
        <div role="dialog" aria-modal="true" aria-label={t("management.auditMessageActions")}
          className={`message-context-menu platform-audit-message-menu ${menu.above ? "above" : "below"}`}
          ref={menuPanel} style={{left: menu.x, top: menu.y}} onClick={event => event.stopPropagation()}>
          <div className="message-context-actions">
            {menu.message.payload?.flash_audit_available && <button type="button" className="message-context-button"
              onClick={() => { setMenu(null); void openFlash(menu.message); }}>
              <span className="material-symbols-outlined" aria-hidden="true">bolt</span>{t("management.inspectFlashOriginal")}
            </button>}
            {menu.delivery && <button type="button" className="message-context-button" onClick={() => {
              setMenu(null);
              onInspectDelivery(menu.delivery!);
            }}>
              <span className="material-symbols-outlined" aria-hidden="true">account_tree</span>{t("management.inspectMessageDelivery")}
            </button>}
          </div>
        </div>
      </div>, document.body)}
    {media && <MediaLightbox items={media.items} index={media.index} onClose={closeMedia} historyKey="platform-audit-media"
      onIndexChange={index => setMedia(current => current ? {...current, index} : current)}
      altPrefix={media.flash ? t("photo.flash") : undefined}
      fixedFitImage={media.flash ? {onReady: () => {}, onError: () => { closeMedia(); showToast(t("photo.flashFailed"), "error"); }} : undefined} />}
  </div>;
}
