import { useState } from "react";
import { localeForLanguage } from "../lib/i18n";
import { useI18n } from "../lib/language";
import type { SquareMedalDTO } from "../types";
import { RecordShopAlbum, RecordShopAlbumFace } from "./RecordShopAlbum";
import { PlainAvatar } from "./UserAvatar";
import "./RecordShopAnnouncementCard.css";

export function RecordShopAnnouncementCard({ announcement }: { announcement: SquareMedalDTO }) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const { album, artist, user, discovered_at } = announcement;
  const date = new Date(discovered_at * 1000);
  const time = date.toLocaleString(localeForLanguage(language), {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="record-shop-announcement" data-tier={album.tier}>
      <button type="button" className="record-shop-announcement-card" aria-haspopup="dialog"
        onClick={event => { event.stopPropagation(); setOpen(true); }}
        onKeyDown={event => event.stopPropagation()}>
        <span className="record-shop-announcement-disc"><RecordShopAlbumFace album={album} /></span>
        <span className="record-shop-announcement-copy">
          <span className="record-shop-announcement-label">{t("recordShop.spaceFirst")} · {t(`recordShop.tier.${album.tier}`)}</span>
          <strong className="record-shop-announcement-title">{album.name}</strong>
          <span className="record-shop-announcement-artist">{t(`recordShop.singer.${artist}`)}</span>
          <span className="record-shop-announcement-winner">
            <span aria-hidden="true"><PlainAvatar name={user.name} uri={user.avatar_uri} cacheKey={user.avatar_cache_key} className="record-shop-announcement-avatar" /></span>
            <strong>{user.name}</strong>
          </span>
          <time dateTime={date.toISOString()}>{time}</time>
        </span>
        <span className="record-shop-announcement-replay">
          <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
          <span>{t("recordShop.replayReveal")}</span>
        </span>
      </button>
      {open ? <RecordShopAlbum album={album} spaceDiscovery={{ winner: user.name, time }} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
