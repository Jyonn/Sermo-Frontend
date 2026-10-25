import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../lib/api";
import { EMOJI_PAGES } from "../lib/composerEmojis";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { StickerAssetDTO, StickerDTO, StickerListDTO } from "../types";
import { ChatEmojiPickerPanel } from "./ChatEmojiPickerPanel";

export function ComposerEmojiPicker({ mobile, onSelect, onSticker, admin = false, inset = false, busy = false }: {
  mobile:boolean; onSelect:(emoji:string)=>void; onSticker:(sticker:StickerAssetDTO)=>Promise<void>;
  admin?:boolean; inset?:boolean; busy?:boolean;
}) {
  const { t } = useI18n();
  const [page,setPage] = useState(-2);
  const [mine,setMine] = useState<StickerListDTO<StickerAssetDTO> | null>(null);
  const [explore,setExplore] = useState<StickerListDTO<StickerAssetDTO> | null>(null);
  const [loading,setLoading] = useState(false);
  const [sending,setSending] = useState(false);
  const serial = useRef(0);
  const loadingRef = useRef(false);
  const sendLock = useRef(false);

  const load = async (append = false, signal?:AbortSignal) => {
    if (loadingRef.current) return;
    const requestId = ++serial.current;
    const isExplore = page === -1;
    const data = isExplore ? explore : mine;
    loadingRef.current = true;setLoading(true);
    try {
      const offset = append ? data?.next_offset ?? 0 : 0;
      const response = admin ? await api.getAdminStickers(isExplore,offset,30,signal)
        : isExplore ? await api.exploreStickers(offset,30,signal) : await api.getStickers(offset,30,signal);
      if (signal?.aborted || requestId !== serial.current) return;
      const update = isExplore ? setExplore : setMine;
      update(current => ({...response,items:append && current
        ? [...current.items,...response.items.filter(item => !current.items.some(old => old.sticker_asset_id === item.sticker_asset_id))]
        : response.items}));
    } catch (error) {
      if (!signal?.aborted && requestId === serial.current) showToast(error instanceof ApiError ? error.message : t("media.loadFailed"),"error");
    } finally {
      if (requestId === serial.current) {loadingRef.current=false;setLoading(false);}
    }
  };
  useEffect(() => {
    if (page >= 0) return;
    const controller = new AbortController();
    loadingRef.current=false;
    void load(false,controller.signal);
    return () => {controller.abort();serial.current++;loadingRef.current=false;};
  },[page,admin]);

  const send = async (sticker:StickerAssetDTO) => {
    if (busy || sendLock.current) return;
    sendLock.current=true;setSending(true);
    try {await onSticker(sticker);} finally {sendLock.current=false;setSending(false);}
  };
  return <div className={mobile ? "mobile-composer-reveal is-open" : `desktop-emoji-reveal${inset ? " is-inset" : ""}`}>
    <div className={mobile ? "mobile-composer-reveal-inner" : undefined}>
      <ChatEmojiPickerPanel emojiPage={page} setEmojiPage={(value)=>{if(value===page && value<0) void load();else setPage(value);}}
        visibleEmojis={page>=0 ? EMOJI_PAGES[page].emojis : []}
        stickers={(mine?.items ?? []) as StickerDTO[]} exploreStickers={explore?.items ?? []} frequentExploreStickerIds={[]}
        stickerSaving={busy || sending} mineStickersLoading={loading && page===-2} exploreStickersLoading={loading && page===-1}
        sendSticker={send} insertEmoji={onSelect}
        handleStickerGridScroll={(event)=>{const element=event.currentTarget;const data=page===-1 ? explore : mine;if(data?.has_more && element.scrollHeight-element.scrollTop-element.clientHeight<120) void load(true);}}/>
    </div>
  </div>;
}
