import { useState, type CSSProperties } from "react";
import { useI18n } from "../lib/language";
import { api } from "../lib/api";
import { showToast } from "../lib/toast";
import { activityPresentation, safeActivityImage } from "../lib/activityPresentation";
import { recordShopArtists as singers } from "../lib/recordShopPreview";
import type { ActivityCampaignDTO, RecordShopAlbum as Album } from "../types";
import { ActivityDetails } from "./ActivityDetails";
import { RecordShopAlbum, RecordShopDecorationView } from "./RecordShopAlbum";
import { RecordShopBubbleArt } from "./RecordShopBubbleArt";
import "./RecordShopActivity.css";

const rules = ["shareRule", "listenRule", "dedupeRule", "selectionRule", "discoveryRule"] as const;
const statusIcons = { equipped: "check", equip: "radio_button_unchecked", choose: "add", locked: "lock" };

export function RecordShopActivity({ activity, dateLabel, onUpdate }: {
  activity: ActivityCampaignDTO;
  dateLabel: string;
  onUpdate: (value: ActivityCampaignDTO) => void;
}) {
  const { t, language } = useI18n();
  const [pending, setPending] = useState("");
  const [catalogSinger, setCatalogSinger] = useState<(typeof singers)[number]>("jay");
  const [album, setAlbum] = useState<Album | null>(null);
  const info = activity.record_shop;
  if (!info) return null;

  const artwork = activityPresentation(activity).artwork_url;
  const summary = language.startsWith("zh") ? activity.summary : activity.summary_en || activity.summary;
  const catalog = info.albums[catalogSinger] ?? [];
  const catalogArtist = t(`recordShop.singer.${catalogSinger}`);
  const decoration = { artist: catalogSinger, portrait: info.portraits[catalogSinger] };
  const [firstChoice, secondChoice] = info.thresholds;
  const target = Math.max(1, secondChoice);
  const choose = async (singer: string) => {
    if (pending) return;
    setPending(singer);
    try {
      onUpdate({ ...activity, record_shop: await api.recordShopSinger(activity.key, singer) });
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("common.retry"), "error");
    } finally {
      setPending("");
    }
  };

  return (
    <section className="record-shop-activity">
      <header className="record-shop-hero">
        {artwork ? <img src={artwork} alt="" decoding="async" /> : null}
        <div className="record-shop-hero-copy">
          <p>{summary.replace("\uff0c", "\uff0c\n")}</p>
          <span>{dateLabel}</span>
        </div>
      </header>
      <div className="record-shop-floor">
        <section className="record-shop-ticket">
          <header>
            <h3>{t("recordShop.points")}</h3>
            <strong>{info.points}<small> / {secondChoice}</small></strong>
          </header>
          <div className="record-shop-ticket-meter" style={{ "--record-first-stop": `${Math.min(firstChoice / target, 1) * 100}%` } as CSSProperties}>
            <progress max={target} value={Math.min(info.points, target)} aria-label={t("recordShop.points")} />
            <i aria-hidden="true" data-reached={info.points >= firstChoice} />
            <i aria-hidden="true" data-reached={info.points >= secondChoice} />
          </div>
          <div className="record-shop-ticket-stops">
            <span>{t("recordShop.firstChoice", { points: firstChoice })}</span>
            <span>{t("recordShop.secondChoice", { points: secondChoice })}</span>
          </div>
        </section>
        <section className="record-shop-shelf">
          <h3>{t("menu.chatBubble")}</h3>
          <div className="record-shop-singers">
            {singers.map(singer => {
              const portrait = safeActivityImage(info.portraits[singer]);
              const status = info.equipped === singer ? "equipped" : info.singers.includes(singer) ? "equip" : info.choices ? "choose" : "locked";
              return (
                <button
                  aria-busy={pending === singer}
                  aria-pressed={status === "equipped"}
                  data-record-shop-artist={singer}
                  disabled={!activity.active || Boolean(pending) || status === "locked" || status === "equipped"}
                  key={singer}
                  onClick={() => void choose(singer)}
                  type="button"
                >
                  {portrait ? <img src={portrait} alt="" decoding="async" /> : null}
                  <span className="record-shop-sleeve-label">
                    <strong>{t(`recordShop.singer.${singer}`)}</strong>
                    <small>
                      <span aria-hidden="true" className="material-symbols-outlined">{statusIcons[status]}</span>
                      {pending === singer ? t("common.processing") : t(`recordShop.${status}`)}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <ActivityDetails
          rules={<ol className="record-shop-rules">{rules.map(rule => <li key={rule}>{t(`recordShop.${rule}`)}</li>)}</ol>}
          rewards={(
            <div className="record-shop-catalog">
              <div className="record-shop-catalog-tabs">
                {singers.map(singer => (
                  <button key={singer} type="button" aria-pressed={catalogSinger === singer} onClick={() => setCatalogSinger(singer)}>
                    {t(`recordShop.singer.${singer}`)}
                  </button>
                ))}
              </div>
              <article className="record-shop-reward" data-record-shop-artist={catalogSinger} key={catalogSinger}>
                <h3>{t("recordShop.bubbleTitle", { artist: catalogArtist })}</h3>
                <div className="record-shop-reward-preview">
                  <div className="message-bubble-shell self group-start" data-record-shop-artist={catalogSinger}>
                    <RecordShopDecorationView decoration={decoration} />
                    <div className="message-bubble self group-start record-shop-text-bubble">
                      <RecordShopBubbleArt artist={catalogSinger} animateOnView />
                      {t("recordShop.bubblePreviewFirst")}
                    </div>
                  </div>
                  {catalog.length ? (
                    <div className="message-bubble-shell self" data-record-shop-artist={catalogSinger}>
                      <RecordShopDecorationView decoration={{ ...decoration, album: catalog[0] }} />
                      <div className="message-bubble self group-end record-shop-text-bubble">
                        <RecordShopBubbleArt artist={catalogSinger} />
                        {t("recordShop.bubblePreviewNext")}
                      </div>
                    </div>
                  ) : null}
                </div>
                <p>{t("recordShop.bubbleElementsHint")}</p>
              </article>
              {catalog.length ? <h4 className="record-shop-elements-title">{t("recordShop.albumElements")}</h4> : null}
              {catalog.map(row => (
                <button className="record-shop-catalog-entry" type="button" key={row.id} onClick={() => setAlbum(row)}>
                  <img src={safeActivityImage(row.cover)} loading="lazy" alt="" />
                  <span><b>{row.name}</b><small>{row.title}</small></span>
                  <small className="record-shop-catalog-tier" data-tier={row.tier}>{t(`recordShop.tier.${row.tier}`)}</small>
                  <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                </button>
              ))}
            </div>
          )}
        />
      </div>
      {album ? <RecordShopAlbum album={album} onClose={() => setAlbum(null)} /> : null}
    </section>
  );
}
