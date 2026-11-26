import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import type { SquareMedalDTO, TinyUserDTO } from "../types";
import { FeedbackState } from "./FeedbackState";
import { RecordShopTierMark } from "./RecordShopAlbum";
import { RecordShopMedalCard } from "./RecordShopMedalCard";
import "./SquareMedals.css";

const medalTiers = ["obsidian", "diamond"] as const;

export function SquareMedals({ active, onProfile }: { active: boolean; onProfile(user: TinyUserDTO): void }) {
  const { t } = useI18n();
  const [records, setRecords] = useState<SquareMedalDTO[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

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
              {group.map(record => (
                <li key={`${record.album.id}:${record.discovered_at}`}>
                  <RecordShopMedalCard medal={record} onProfile={() => onProfile(record.user)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
