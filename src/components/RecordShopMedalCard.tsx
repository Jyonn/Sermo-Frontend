import { useId, useState } from "react";
import { localeForLanguage } from "../lib/i18n";
import { useI18n } from "../lib/language";
import type { SquareMedalDTO } from "../types";
import { safeActivityImage } from "../lib/activityPresentation";
import { RecordShopAlbum, RecordShopAlbumFace, RecordShopTierMark } from "./RecordShopAlbum";
import { UserAvatar } from "./UserAvatar";
import "./RecordShopMedalCard.css";

export function RecordShopMedalCard({ medal, onProfile }: { medal: SquareMedalDTO; onProfile: () => void }) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const { album, artist, user, discovered_at } = medal;
  const cover = safeActivityImage(album.cover);
  const date = new Date(discovered_at * 1000);
  const dateLabel = date.toLocaleDateString(localeForLanguage(language), {
    month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });

  return (
    <div className="record-shop-medal" data-tier={album.tier}>
      <div className="record-shop-medal-card">
        <button type="button" className="record-shop-medal-replay" aria-haspopup="dialog" aria-describedby={detailsId}
          aria-label={`${t("recordShop.replayReveal")} · ${album.name}`} onClick={() => setOpen(true)}>
          <span aria-hidden="true">↗</span>
        </button>
        <span className="record-shop-medal-artwork" aria-hidden="true">
          <RecordShopAlbumFace album={{ ...album, cover: "" }} />
          {cover ? <img src={cover} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true; }} /> : null}
        </span>
        <div className="record-shop-medal-copy" id={detailsId}>
          <span className="record-shop-medal-label">
            <RecordShopTierMark tier={album.tier} />
            {t(`recordShop.tier.${album.tier}`)} · {t("recordShop.spaceFirst")}
          </span>
          <strong className="record-shop-medal-title">{album.name}</strong>
          <span className="record-shop-medal-artist">{t(`recordShop.singer.${artist}`)}</span>
          <div className="record-shop-medal-credit">
            <button type="button" className="record-shop-medal-winner" onClick={onProfile}>
              <span aria-hidden="true"><UserAvatar name={user.name} uri={user.avatar_uri} frame={user.avatar_frame_style}
                cacheKey={user.avatar_cache_key} className="record-shop-medal-avatar" /></span>
              <strong>{user.name}</strong>
            </button>
            <time dateTime={date.toISOString()}>{dateLabel}</time>
          </div>
        </div>
      </div>
      {open ? <RecordShopAlbum album={album} spaceDiscovery={{ winner: user.name, time: dateLabel }} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
