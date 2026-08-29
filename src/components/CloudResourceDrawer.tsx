import { useDeferredValue, useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, ApiError } from "../lib/api";
import { formatCloudResourceBytes } from "../lib/cloudResources";
import { uploadMessageMedia } from "../lib/messageUpload";
import { showToast } from "../lib/toast";
import { useI18n } from "../lib/language";
import { useAuth } from "../lib/auth";
import type { ChatDTO, CloudResourceDTO, CloudResourceListDTO } from "../types";
import { BottomSheet } from "./BottomSheet";
import { ChatTargetPicker } from "./ChatTargetPicker";
import { ContentLoader, QuietState } from "./BoundaryState";
import { CloudFileList } from "./CloudFileList";
import { MediaLightbox } from "./ImageLightbox";
import { MediaMetadataPanel } from "./MediaMetadataPanel";
import { MediaResourceGrid, type MediaResourceGridItem } from "./MediaResourceGrid";
import { SideDrawer } from "./SideDrawer";

type ResourceTab = "image" | "video" | "file";

interface CloudResourceDrawerProps {
  open: boolean;
  onClose: () => void;
  onRouteOpen?: () => void;
  currentChatId?: number;
  initialTab?: ResourceTab;
  onSent?: () => void;
}

const messageType = { image: 1, file: 2, video: 4, audio: 5 } as const;

function chatTitle(chat: ChatDTO) {
  return chat.title || chat.owner?.name || chat.members.map((member) => member.name).join("、") || "会话";
}

export function CloudResourceDrawer({ open, onClose, onRouteOpen, currentChatId, initialTab = "image", onSent }: CloudResourceDrawerProps) {
  const { t } = useI18n();
  const { session } = useAuth();
  const [tab, setTab] = useState<ResourceTab>(initialTab);
  const [data, setData] = useState<CloudResourceListDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const deferredFileQuery = useDeferredValue(fileQuery.trim());
  const [busyId, setBusyId] = useState<number | "upload" | null>(null);
  const [sendAsset, setSendAsset] = useState<CloudResourceDTO | null>(null);
  const [sendingChatId, setSendingChatId] = useState<number | null>(null);
  const [actionAsset, setActionAsset] = useState<CloudResourceDTO | null>(null);
  const [chats, setChats] = useState<ChatDTO[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [highlightedResourceId, setHighlightedResourceId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const requestSerialRef = useRef(0);

  const load = async (nextTab = tab, append = false) => {
    const requestSerial = ++requestSerialRef.current;
    const offset = append ? (data?.next_offset || 0) : 0;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const response = await api.getCloudResources(nextTab, {
        offset,
        limit: 60,
        keyword: nextTab === "file" ? deferredFileQuery || undefined : undefined,
      });
      if (requestSerial !== requestSerialRef.current) return;
      setData((current) => {
        if (!append || !current) return response;
        const knownIds = new Set(current.items.map((item) => item.resource_id));
        return {
          ...response,
          items: [...current.items, ...response.items.filter((item) => !knownIds.has(item.resource_id))],
        };
      });
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("cloudResources.loadFailed"), "error");
    } finally {
      if (requestSerial === requestSerialRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    if (initialTab !== "file") void load(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || tab !== "file") return;
    setData(null);
    void load("file");
  }, [open, tab, deferredFileQuery]);

  const chooseTab = (nextTab: ResourceTab) => {
    setTab(nextTab);
    setData(null);
    setActionAsset(null);
    if (nextTab !== "file") void load(nextTab);
  };

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!open || !node || !data?.has_more || loading || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void load(tab, true);
    }, {
      root: node.closest(".drawer-body"),
      rootMargin: "240px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, tab, data?.has_more, data?.next_offset, loading, loadingMore]);

  const removeUnavailableResource = (resourceId: number) => {
    setData((current) => current ? {
      ...current,
      items: current.items.filter((item) => item.resource_id !== resourceId),
    } : current);
  };

  const sendToChat = async (asset: CloudResourceDTO, chatId: number) => {
    setBusyId(asset.resource_id);
    setSendingChatId(chatId);
    try {
      await api.sendMessage(chatId, messageType[asset.kind], "", undefined, undefined, [], asset.resource_id);
      showToast(t("cloudResources.sent"));
      setSendAsset(null);
      onSent?.();
      if (currentChatId) onClose();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("cloudResources.sendFailed"), "error");
    } finally {
      setBusyId(null);
      setSendingChatId(null);
    }
  };

  const requestSend = async (asset: CloudResourceDTO) => {
    setActionAsset(null);
    if (currentChatId) {
      await sendToChat(asset, currentChatId);
      return;
    }
    setSendAsset(asset);
    if (!chats.length) {
      setChatsLoading(true);
      try {
        const rows = await api.getChats();
        setChats([...rows].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.last_chat_at - a.last_chat_at));
      } catch (error) {
        showToast(error instanceof ApiError ? error.message : t("cloudResources.sendFailed"), "error");
      } finally {
        setChatsLoading(false);
      }
    }
  };

  const deleteAsset = async (asset: CloudResourceDTO) => {
    if (asset.reference_count > 0) {
      showToast(t("cloudResources.inUse"), "error");
      return;
    }
    setBusyId(asset.resource_id);
    try {
      await api.deleteCloudResource(asset.resource_id);
      showToast(t("cloudResources.deleted"));
      setActionAsset(null);
      await load();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("cloudResources.deleteFailed"), "error");
    } finally {
      setBusyId(null);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || tab === "image") return;
    setBusyId("upload");
    try {
      await uploadMessageMedia(file, tab);
      showToast(t("cloudResources.uploaded"));
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("cloudResources.uploadFailed"), "error");
    } finally {
      setBusyId(null);
    }
  };

  const quota = data?.quota;
  const mediaItems = (data?.items || []).filter((asset) => asset.kind === "image" || asset.kind === "video");
  const headerAction = tab !== "image" ? (
    <button
      aria-label={t("cloudResources.upload")}
      className="cloud-resource-header-action"
      disabled={busyId === "upload"}
      onClick={() => inputRef.current?.click()}
      type="button"
    >
      <span className={`material-symbols-outlined${busyId === "upload" ? " is-spinning" : ""}`}>
        {busyId === "upload" ? "progress_activity" : "add"}
      </span>
    </button>
  ) : null;

  const moreButton = (asset: CloudResourceDTO) => (
    <button
      aria-label={t("common.actions")}
      className="cloud-resource-more"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setActionAsset(asset);
      }}
      type="button"
    >
      <span className="material-symbols-outlined">more_horiz</span>
    </button>
  );

  const closePreview = () => {
    const asset = previewIndex === null ? null : mediaItems[previewIndex];
    setPreviewIndex(null);
    if (!asset) return;
    setHighlightedResourceId(asset.resource_id);
    window.setTimeout(() => {
      document.querySelector(`[data-resource-id="${asset.resource_id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
    window.setTimeout(() => setHighlightedResourceId((current) => current === asset.resource_id ? null : current), 1800);
  };

  const mediaGridItems: MediaResourceGridItem[] = mediaItems.map((asset) => ({
    id: asset.resource_id,
    kind: asset.kind as "image" | "video",
    uri: asset.uri,
    thumbnailUri: asset.thumbnail_uri,
    createdAt: asset.created_at,
    durationSeconds: asset.duration_seconds,
    label: asset.file_name,
  }));

  return (
    <>
      <SideDrawer className="cloud-resource-drawer" headerAction={headerAction} historyKey="cloud-resources" onRouteOpen={onRouteOpen} onClose={onClose} open={open} title={t("cloudResources.title")}>
        <div className="cloud-resource-layout">
          {quota ? (
            <div className="cloud-resource-quota">
              <span><strong>{formatCloudResourceBytes(quota.used)}</strong><small> / {formatCloudResourceBytes(quota.limit)}</small></span>
              <em>{Math.round(quota.used / quota.limit * 100)}%</em>
              <i><span style={{ width: `${Math.min(100, quota.used / quota.limit * 100)}%` }} /></i>
              <small>{t("cloudResources.quotaHint")}</small>
            </div>
          ) : null}
          <div className="cloud-resource-tabs" role="tablist">
            {(["image", "video", "file"] as ResourceTab[]).map((item) => (
              <button aria-selected={tab === item} className={tab === item ? "is-active" : ""} key={item} onClick={() => chooseTab(item)} role="tab" type="button">
                {t(`cloudResources.tab.${item}` as never)}
              </button>
            ))}
          </div>
          {loading && !data ? <ContentLoader label={t("common.loading")} /> : null}
          {tab !== "file" && !loading && data?.items.length === 0 ? <QuietState title={t("cloudResources.empty")} /> : null}
          {tab === "image" || tab === "video" ? <MediaResourceGrid
            highlightedId={highlightedResourceId}
            items={mediaGridItems}
            onImageError={(item) => removeUnavailableResource(Number(item.id))}
            onSelect={(item) => setPreviewIndex(mediaItems.findIndex((asset) => asset.resource_id === item.id))}
            renderAction={(item) => moreButton(mediaItems.find((asset) => asset.resource_id === item.id)!)}
          /> : null}
          {tab === "file" ? (
            <>
              <CloudFileList items={data?.items || []} onQueryChange={setFileQuery} onSelect={(asset) => {
                const anchor = document.createElement("a");
                anchor.href = asset.uri;
                anchor.download = asset.file_name || "sermo-file";
                anchor.click();
              }} query={fileQuery} renderAction={moreButton} />
              {!loading && data?.items.length === 0 ? (
                <QuietState title={deferredFileQuery ? t("cloudResources.noMatchingFiles") : t("cloudResources.emptyFiles")} />
              ) : null}
            </>
          ) : null}
          {data?.has_more || loadingMore ? (
            <div aria-hidden="true" className={`cloud-resource-load-more${loadingMore ? " is-loading" : ""}`} ref={loadMoreRef}>
              <span className="material-symbols-outlined">progress_activity</span>
            </div>
          ) : <div aria-hidden="true" className="cloud-resource-load-more" ref={loadMoreRef} />}
        </div>
        <input hidden onChange={(event) => void upload(event)} ref={inputRef} type="file" />
      </SideDrawer>
      <BottomSheet className="cloud-resource-action-sheet" onClose={() => setActionAsset(null)} open={Boolean(actionAsset)} title={actionAsset?.file_name || t(`cloudResources.tab.${actionAsset?.kind || tab}` as never)}>
        {actionAsset ? (
          <div className="cloud-resource-action-list">
            <button disabled={busyId === actionAsset.resource_id} onClick={() => void requestSend(actionAsset)} type="button"><span className="material-symbols-outlined">send</span><span>{t("cloudResources.send")}</span></button>
            <a download href={actionAsset.uri} onClick={() => setActionAsset(null)}><span className="material-symbols-outlined">download</span><span>{t("cloudResources.download")}</span></a>
            {actionAsset.kind !== "image" ? <button className="is-danger" disabled={busyId === actionAsset.resource_id} onClick={() => void deleteAsset(actionAsset)} type="button"><span className="material-symbols-outlined">delete</span><span>{t("common.delete")}</span></button> : null}
          </div>
        ) : null}
      </BottomSheet>
      <ChatTargetPicker
        busy={busyId !== null}
        busyTargetId={sendingChatId}
        emptyTitle={t("square.noChatsToShare")}
        loading={chatsLoading}
        onClose={() => { if (busyId === null) setSendAsset(null); }}
        onSubmit={(ids) => sendAsset ? sendToChat(sendAsset, ids[0]) : undefined}
        open={Boolean(sendAsset)}
        targets={chats.map((chat) => {
          const peer = chat.group ? null : chat.members.find((member) => member.user_id !== session?.user.user_id) ?? chat.members[0];
          return {
            id: chat.chat_id,
            title: chat.title || peer?.name || chatTitle(chat),
            preview: chat.last_message?.content || (chat.group ? t("chat.group") : t("square.directChat")),
            pinned: Boolean(chat.pinned),
            avatarUri: peer?.avatar_uri,
            avatarCacheKey: peer?.avatar_cache_key,
            avatarFrameStyle: peer?.avatar_frame_style,
            groupMembers: chat.group ? chat.members.map((member) => ({ name: member.name, uri: member.avatar_uri, cacheKey: member.avatar_cache_key })) : undefined,
          };
        })}
        title={t("cloudResources.chooseChat")}
      />
      {previewIndex !== null && mediaItems.length ? <MediaLightbox
        fileNamePrefix="sermo-cloud"
        index={previewIndex}
        items={mediaItems.map((asset) => ({
          uri: asset.uri,
          kind: asset.kind as "image" | "video",
          posterUri: asset.thumbnail_uri,
          width: asset.pixel_width,
          height: asset.pixel_height,
          detail: <MediaMetadataPanel kind={asset.kind as "image" | "video"} metadata={asset.metadata} />,
          downloadLabel: formatCloudResourceBytes(asset.file_size),
        }))}
        onApproachingEnd={() => { if (data?.has_more && !loadingMore) void load(tab, true); }}
        onClose={closePreview}
        onIndexChange={setPreviewIndex}
        totalCount={data?.total_count}
      /> : null}
    </>
  );
}
