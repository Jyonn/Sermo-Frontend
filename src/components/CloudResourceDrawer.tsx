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
    void load(nextTab);
  };

  const sendToChat = async (asset: CloudResourceDTO, chatId: number) => {
    setBusyId(asset.asset_id);
    try {
      await api.sendMessage(chatId, messageType[asset.kind], "", undefined, undefined, [], asset.asset_id);
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
    setBusyId(asset.asset_id);
    try {
      await api.deleteCloudResource(asset.asset_id);
      showToast(t("cloudResources.deleted"));
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
  return (
    <>
      <SideDrawer className="cloud-resource-drawer" historyKey="cloud-resources" onClose={onClose} open={open} title={t("cloudResources.title")}>
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
              <span><strong>{formatBytes(quota.used)}</strong> / {formatBytes(quota.limit)}</span>
              <i><span style={{ width: `${Math.min(100, quota.used / quota.limit * 100)}%` }} /></i>
              <small>{t("cloudResources.quotaHint")}</small>
            </div>
          ) : null}
          {tab !== "image" ? (
            <button className="cloud-resource-upload" disabled={busyId === "upload"} onClick={() => inputRef.current?.click()} type="button">
              <span className="material-symbols-outlined">cloud_upload</span>
              <span>{busyId === "upload" ? t("common.loading") : t("cloudResources.upload")}</span>
            </button>
          ) : null}
          {loading && !data ? <ContentLoader label={t("common.loading")} /> : null}
          {!loading && data?.items.length === 0 ? <QuietState title={t("cloudResources.empty")} /> : null}
          <div className="cloud-resource-grid">
            {data?.items.map((asset) => (
              <article className="cloud-resource-card" key={asset.asset_id}>
                <a className="cloud-resource-preview" href={asset.uri} rel="noreferrer" target="_blank">
                  {asset.kind === "image" ? <img alt="" src={asset.thumbnail_uri || asset.uri} /> : null}
                  {asset.kind === "video" ? <video muted playsInline poster={asset.thumbnail_uri || undefined} preload="metadata" src={asset.uri} /> : null}
                  {asset.kind === "file" ? <span className="material-symbols-outlined">draft</span> : null}
                </a>
                <div className="cloud-resource-meta">
                  <strong title={asset.file_name}>{asset.file_name || t(`cloudResources.tab.${asset.kind}` as never)}</strong>
                  <span>{formatBytes(asset.file_size)}</span>
                </div>
                <div className="cloud-resource-actions">
                  <button disabled={busyId === asset.asset_id} onClick={() => void requestSend(asset)} type="button">{t("cloudResources.send")}</button>
                  <a download href={asset.uri}>{t("cloudResources.download")}</a>
                  {asset.kind !== "image" ? <button className="is-danger" disabled={busyId === asset.asset_id} onClick={() => void deleteAsset(asset)} type="button">{t("common.delete")}</button> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
        <input hidden onChange={(event) => void upload(event)} ref={inputRef} type="file" />
      </SideDrawer>
      <BottomSheet onClose={() => setSendAsset(null)} open={Boolean(sendAsset)} title={t("cloudResources.chooseChat")}>
        <div className="cloud-resource-chat-list">
          {chats.map((chat) => <button key={chat.chat_id} onClick={() => sendAsset && void sendToChat(sendAsset, chat.chat_id)} type="button"><strong>{chatTitle(chat)}</strong><span className="material-symbols-outlined">send</span></button>)}
        </div>
      </BottomSheet>
    </>
  );
}
