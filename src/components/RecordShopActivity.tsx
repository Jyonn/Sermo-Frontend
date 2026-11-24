import { useState, type CSSProperties } from "react";
import { useI18n } from "../lib/language";
import { api } from "../lib/api";
import { showToast } from "../lib/toast";
import { activityPresentation, safeActivityImage } from "../lib/activityPresentation";
import { recordShopArtists as singers } from "../lib/recordShopPreview";
import type { ActivityCampaignDTO, RecordShopAlbum as Album } from "../types";
import { ActivityDetails } from "./ActivityDetails";
import { DrawerTabs } from "./DrawerTabs";
import { RecordShopAlbum, RecordShopAlbumFace, RecordShopDecorationView, RecordShopTierMark } from "./RecordShopAlbum";
import { RecordShopBubbleArt } from "./RecordShopBubbleArt";
import "./RecordShopActivity.css";

const rules = ["shareRule", "listenRule", "dedupeRule", "selectionRule", "discoveryRule"] as const;
const statusIcons = { equipped: "check", equip: "radio_button_unchecked", choose: "add", locked: "lock" };
const tiers = ["gold", "platinum", "diamond", "obsidian"] as const;
type Singer = (typeof singers)[number];
type ShopInfo = NonNullable<ActivityCampaignDTO["record_shop"]>;

function singerStatus(info: ShopInfo, singer: Singer) {
  if (info.equipped === singer) return "equipped";
  if (info.singers.includes(singer)) return "equip";
  return info.choices ? "choose" : "locked";
}

export function RecordShopActivity({ activity, dateLabel, onUpdate }: {
  activity: ActivityCampaignDTO;
  dateLabel: string;
  onUpdate: (value: ActivityCampaignDTO) => void;
}) {
  const { t, language } = useI18n();
  const [pending, setPending] = useState("");
  const [selectedSinger, setCatalogSinger] = useState<Singer | null>(null);
  const [tier, setTier] = useState<Album["tier"]>("gold");
  const [album, setAlbum] = useState<Album | null>(null);
  const info = activity.record_shop;
  const roster = singers.filter(singer => Boolean(info?.portraits[singer]));
  if (!info || !roster.length) return null;

  const catalogSinger = selectedSinger && roster.includes(selectedSinger) ? selectedSinger : roster[0];
  const artwork = activityPresentation(activity).artwork_url;
  const summary = language.startsWith("zh") ? activity.summary : activity.summary_en || activity.summary;
  const catalog = info.albums[catalogSinger] ?? [];
  const displayedAlbums = catalog.filter(item => item.tier === tier);
  const catalogArtist = t(`recordShop.singer.${catalogSinger}`);
  const catalogStatus = singerStatus(info, catalogSinger);
  const decoration = { artist: catalogSinger, portrait: info.portraits[catalogSinger] };
  const [firstChoice, secondChoice] = info.thresholds;
  const target = Math.max(1, secondChoice);
  const selectSinger = (singer: Singer) => {
    if (singer === catalogSinger) return;
    setCatalogSinger(singer);
    setTier(tiers.find(value => info.albums[singer]?.some(item => item.tier === value)) ?? "gold");
  };
  const choose = async (singer: Singer) => {
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
    <section className="record-shop-activity" data-edition={activity.key === "record-shop-women" ? "women" : undefined}>
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
        <ActivityDetails
          overview={openRewards => (
            <section className="record-shop-shelf">
              <h3>{t("menu.chatBubble")}</h3>
              <div className="record-shop-singers">
                {roster.map(singer => {
                  const portrait = safeActivityImage(info.portraits[singer]);
                  const status = singerStatus(info, singer);
                  return (
                    <button
                      aria-haspopup="dialog"
                      data-equipped={status === "equipped"}
                      data-record-shop-artist={singer}
                      key={singer}
                      onClick={() => {
                        selectSinger(singer);
                        openRewards();
                      }}
                      type="button"
                    >
                      {portrait ? <img src={portrait} alt="" decoding="async" /> : null}
                      <span className="record-shop-sleeve-label">
                        <strong>{t(`recordShop.singer.${singer}`)}</strong>
                        <small>
                          <span aria-hidden="true" className="material-symbols-outlined">{statusIcons[status]}</span>
                          {t(`recordShop.${status}`)}
                        </small>
                      </span>
                      <span aria-hidden="true" className="record-shop-sleeve-open material-symbols-outlined">arrow_outward</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          rules={<ol className="record-shop-rules">{rules.map(rule => <li key={rule}>{t(`recordShop.${rule}`)}</li>)}</ol>}
          rewards={(
            <div className="record-shop-catalog">
              <DrawerTabs
                className="record-shop-catalog-artists"
                label={t("menu.chatBubble")}
                value={catalogSinger}
                onChange={selectSinger}
                items={roster.map(singer => {
                  const label = t(`recordShop.singer.${singer}`);
                  const portrait = safeActivityImage(info.portraits[singer]);
                  return {
                    value: singer,
                    label,
                    content: (
                      <span className="record-shop-catalog-sleeve" data-record-shop-artist={singer}>
                        {portrait ? <img src={portrait} alt="" decoding="async" /> : null}
                        <strong>{label}</strong>
                      </span>
                    ),
                  };
                })}
              />
              <article className="record-shop-reward" data-record-shop-artist={catalogSinger} key={catalogSinger}>
                <header>
                  <h3>{t("recordShop.bubbleTitle", { artist: catalogArtist })}</h3>
                  <button
                    className="record-shop-reward-action"
                    type="button"
                    aria-busy={pending === catalogSinger}
                    disabled={(!activity.active && catalogStatus === "choose") || Boolean(pending) || catalogStatus === "locked" || catalogStatus === "equipped"}
                    onClick={() => void choose(catalogSinger)}
                  >
                    <span aria-hidden="true" className="material-symbols-outlined">{statusIcons[catalogStatus]}</span>
                    {pending === catalogSinger ? t("common.processing") : t(`recordShop.${catalogStatus}`)}
                  </button>
                </header>
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
              </article>
              <section className="record-shop-albums">
                <h4>{t("recordShop.albumElements")}</h4>
                <DrawerTabs
                  className="record-shop-catalog-tiers"
                  label={t("recordShop.albumElements")}
                  value={tier}
                  onChange={setTier}
                  items={tiers.map(value => {
                    const label = t(`recordShop.tier.${value}`);
                    return { value, label, content: <><RecordShopTierMark tier={value} /><span>{label}</span></> };
                  })}
                />
                <div className="record-shop-album-grid" role="tabpanel" aria-label={t(`recordShop.tier.${tier}`)}>
                  {displayedAlbums.map(row => (
                    <button className="record-shop-catalog-entry" type="button" key={row.id} onClick={() => setAlbum(row)}>
                      <RecordShopAlbumFace album={row} />
                      <b>{row.name}</b>
                      {row.title !== row.name ? <small>{row.title}</small> : null}
                    </button>
                  ))}
                  {displayedAlbums.length === 0 ? <p className="record-shop-catalog-empty">{t("resources.noResults")}</p> : null}
                </div>
              </section>
            </div>
          )}
        />
      </div>
      {album ? <RecordShopAlbum album={album} onClose={() => setAlbum(null)} /> : null}
    </section>
  );
}
