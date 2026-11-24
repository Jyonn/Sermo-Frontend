import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { localeForLanguage } from "../lib/i18n";
import { useI18n } from "../lib/language";
import type { SquareMedalDTO, TinyUserDTO } from "../types";
import { FeedbackState } from "./FeedbackState";
import { RecordShopAlbumFace, RecordShopTierMark } from "./RecordShopAlbum";
import { UserAvatar } from "./UserAvatar";
import "./SquareMedals.css";

const medalTiers = ["obsidian", "diamond"] as const;

export function SquareMedals({ active, onProfile }: { active: boolean; onProfile(user: TinyUserDTO): void }) {
  const { t, language } = useI18n();
  const [records, setRecords] = useState<SquareMedalDTO[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(localeForLanguage(language), {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }), [language]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setFailed(false);
    void api.getSquareMedals(controller.signal).then(rows => {
      if (!controller.signal.aborted) setRecords(rows);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [active, retry]);

  if (failed) {
    return <FeedbackState tone="error" title={t("square.loadFailed")} action={
      <button className="secondary-button" onClick={() => setRetry(value => value + 1)} type="button">{t("common.retry")}</button>
    } />;
  }
  if (!records) return <FeedbackState tone="loading" title={t("common.loading")} />;
  if (!records.length) return <FeedbackState tone="empty" title={t("square.medalsEmpty")} />;

  return (
    <section className="square-medals">
      <h2>{t("square.medalsRecordShop")}</h2>
      {medalTiers.map(tier => {
        const group = records.filter(record => record.album.tier === tier);
        if (!group.length) return null;
        return (
          <section className="square-medal-section" data-tier={tier} key={tier}>
            <h3><RecordShopTierMark tier={tier} />{t(`recordShop.tier.${tier}`)}</h3>
            <ul className="square-medal-list">
              {group.map(record => {
                const date = new Date(record.discovered_at * 1000);
                return (
                  <li className="square-medal-ticket" key={record.album.id}>
                    <RecordShopAlbumFace album={record.album} />
                    <div className="square-medal-copy">
                      <h4>{record.album.name}</h4>
                      <span>{t(`recordShop.singer.${record.artist}`)}</span>
                      <div className="square-medal-winner">
                        <button type="button" aria-label={record.user.name} onClick={() => onProfile(record.user)}>
                          <UserAvatar
                            name={record.user.name}
                            uri={record.user.avatar_uri}
                            frame={record.user.avatar_frame_style}
                            cacheKey={record.user.avatar_cache_key}
                            className="square-medal-avatar"
                          />
                          <strong>{record.user.name}</strong>
                        </button>
                        <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
