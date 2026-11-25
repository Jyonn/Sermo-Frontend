import { useId, useState } from "react";
import { localeForLanguage } from "../lib/i18n";
import { useI18n } from "../lib/language";
import type { SquareMedalDTO } from "../types";
import { safeActivityImage } from "../lib/activityPresentation";
import { RecordShopAlbum, RecordShopAlbumFace, RecordShopTierMark } from "./RecordShopAlbum";
import { PlainAvatar } from "./UserAvatar";
import "./RecordShopAnnouncementCard.css";

export function RecordShopAnnouncementCard({ announcement }: { announcement: SquareMedalDTO }) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const { album, artist, user, discovered_at } = announcement;
  const cover = safeActivityImage(album.cover);
  const date = new Date(discovered_at * 1000);
  const time = date.toLocaleString(localeForLanguage(language), {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="record-shop-announcement" data-tier={album.tier}>
      <button type="button" className="record-shop-announcement-card" aria-haspopup="dialog" aria-describedby={detailsId}
        aria-label={`${t("recordShop.replayReveal")} · ${album.name}`}
        onClick={event => { event.stopPropagation(); setOpen(true); }}
        onKeyDown={event => event.stopPropagation()}>
        <span className="record-shop-announcement-artwork" aria-hidden="true">
          <RecordShopAlbumFace album={{ ...album, cover: "" }} />
          {cover ? <img src={cover} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true; }} /> : null}
        </span>
        <span className="record-shop-announcement-copy" id={detailsId}>
          <span className="record-shop-announcement-label">
            <RecordShopTierMark tier={album.tier} />
            {t(`recordShop.tier.${album.tier}`)} · {t("recordShop.spaceFirst")}
          </span>
          <strong className="record-shop-announcement-title">{album.name}</strong>
          <span className="record-shop-announcement-artist">{t(`recordShop.singer.${artist}`)}</span>
          <span className="record-shop-announcement-winner">
            <span aria-hidden="true"><PlainAvatar name={user.name} uri={user.avatar_uri} cacheKey={user.avatar_cache_key} className="record-shop-announcement-avatar" /></span>
            <span className="record-shop-announcement-credit">
              <strong>{user.name}</strong>
              <time dateTime={date.toISOString()}>{time}</time>
            </span>
          </span>
        </span>
        <span className="record-shop-announcement-replay" aria-hidden="true">↗</span>
      </button>
      {open ? <RecordShopAlbum album={album} spaceDiscovery={{ winner: user.name, time }} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
