import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, ApiError } from "../lib/api";
import { uploadMessageMedia } from "../lib/messageUpload";
import { showToast } from "../lib/toast";
import { useI18n } from "../lib/language";
import type { ChatDTO, CloudResourceDTO, CloudResourceListDTO } from "../types";
import { BottomSheet } from "./BottomSheet";
import { ContentLoader, QuietState } from "./BoundaryState";
import { SideDrawer } from "./SideDrawer";

type ResourceTab = "image" | "video" | "file";

interface CloudResourceDrawerProps {
  open: boolean;
  onClose: () => void;
  currentChatId?: number;
  initialTab?: ResourceTab;
  onSent?: () => void;
}

const messageType = { image: 1, file: 2, video: 4, audio: 5 } as const;

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function chatTitle(chat: ChatDTO) {
  return chat.title || chat.owner?.name || chat.members.map((member) => member.name).join("、") || "会话";
}

export function CloudResourceDrawer({ open, onClose, currentChatId, initialTab = "image", onSent }: CloudResourceDrawerProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<ResourceTab>(initialTab);
  const [data, setData] = useState<CloudResourceListDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | "upload" | null>(null);
  const [sendAsset, setSendAsset] = useState<CloudResourceDTO | null>(null);
  const [actionAsset, setActionAsset] = useState<CloudResourceDTO | null>(null);
  const [chats, setChats] = useState<ChatDTO[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = async (nextTab = tab) => {
    setLoading(true);
    try {
      setData(await api.getCloudResources(nextTab));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("cloudResources.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    void load(initialTab);
  }, [open, initialTab]);

  const chooseTab = (nextTab: ResourceTab) => {
    setTab(nextTab);
    setActionAsset(null);
    void load(nextTab);
  };

  const removeUnavailableResource = (resourceId: number) => {
    setData((current) => current ? {
      ...current,
      items: current.items.filter((item) => item.resource_id !== resourceId),
    } : current);
  };

  const sendToChat = async (asset: CloudResourceDTO, chatId: number) => {
    setBusyId(asset.resource_id);
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
      try {
        const rows = await api.getChats();
        setChats([...rows].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.last_chat_at - a.last_chat_at));
      } catch (error) {
        showToast(error instanceof ApiError ? error.message : t("cloudResources.sendFailed"), "error");
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

  return (
    <>
      <SideDrawer className="cloud-resource-drawer" headerAction={headerAction} historyKey="cloud-resources" onClose={onClose} open={open} title={t("cloudResources.title")}>
        <div className="cloud-resource-layout">
          <div className="cloud-resource-tabs" role="tablist">
            {(["image", "video", "file"] as ResourceTab[]).map((item) => (
              <button aria-selected={tab === item} className={tab === item ? "is-active" : ""} key={item} onClick={() => chooseTab(item)} role="tab" type="button">
                {t(`cloudResources.tab.${item}` as never)}
              </button>
            ))}
          </div>
          {quota ? (
            <div className="cloud-resource-quota">
              <span><strong>{formatBytes(quota.used)}</strong><small> / {formatBytes(quota.limit)}</small></span>
              <em>{Math.round(quota.used / quota.limit * 100)}%</em>
              <i><span style={{ width: `${Math.min(100, quota.used / quota.limit * 100)}%` }} /></i>
              <small>{t("cloudResources.quotaHint")}</small>
            </div>
          ) : null}
          {loading && !data ? <ContentLoader label={t("common.loading")} /> : null}
          {!loading && data?.items.length === 0 ? <QuietState title={t("cloudResources.empty")} /> : null}
          {tab === "image" ? (
            <div className="cloud-resource-image-grid">
              {data?.items.map((asset) => (
                <article className="cloud-resource-image" key={asset.resource_id}>
                  <a className="cloud-resource-image-link" href={asset.uri} rel="noreferrer" target="_blank">
                    <img alt={asset.file_name || ""} loading="lazy" onError={() => removeUnavailableResource(asset.resource_id)} src={asset.thumbnail_uri || asset.uri} />
                  </a>
                  {moreButton(asset)}
                </article>
              ))}
            </div>
          ) : null}
          {tab === "video" ? (
            <div className="cloud-resource-video-grid">
              {data?.items.map((asset) => (
                <article className="cloud-resource-video" key={asset.resource_id}>
                  <a className="cloud-resource-video-preview" href={asset.uri} rel="noreferrer" target="_blank">
                    <img alt="" loading="lazy" onError={() => removeUnavailableResource(asset.resource_id)} src={asset.thumbnail_uri || asset.uri} />
                    <span className="cloud-resource-play material-symbols-outlined">play_arrow</span>
                    {asset.duration_seconds ? <small>{Math.floor(asset.duration_seconds / 60)}:{String(Math.round(asset.duration_seconds % 60)).padStart(2, "0")}</small> : null}
                  </a>
                  <div><strong>{asset.file_name || t("cloudResources.tab.video")}</strong><span>{formatBytes(asset.file_size)}</span></div>
                  {moreButton(asset)}
                </article>
              ))}
            </div>
          ) : null}
          {tab === "file" ? (
            <div className="cloud-resource-file-list">
              {data?.items.map((asset) => (
                <article className="cloud-resource-file" key={asset.resource_id}>
                  <span className="cloud-resource-file-icon material-symbols-outlined">draft</span>
                  <div><strong>{asset.file_name || t("cloudResources.tab.file")}</strong><span>{formatBytes(asset.file_size)}</span></div>
                  {moreButton(asset)}
                </article>
              ))}
            </div>
          ) : null}
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
      <BottomSheet onClose={() => setSendAsset(null)} open={Boolean(sendAsset)} title={t("cloudResources.chooseChat")}>
        <div className="cloud-resource-chat-list">
          {chats.map((chat) => <button key={chat.chat_id} onClick={() => sendAsset && void sendToChat(sendAsset, chat.chat_id)} type="button"><strong>{chatTitle(chat)}</strong><span className="material-symbols-outlined">send</span></button>)}
        </div>
      </BottomSheet>
    </>
  );
}
