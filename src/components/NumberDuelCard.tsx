import { useI18n } from "../lib/language";
import type { DuelRoomSummary } from "../lib/numberDuel";
import { ActivityTitle } from "./ActivityCampaignCard";
import "./NumberDuelCard.css";
import "./NumberDuelDigits.css";

export function NumberDuelCard({ room, onClick, className = "" }: { room?: DuelRoomSummary | null; onClick?: () => void; className?: string }) {
  const { t } = useI18n();
  return <button type="button" className={`number-duel-card ${className}`} onClick={(event) => { event.stopPropagation(); onClick?.(); }} disabled={!onClick}>
    <span className="duel-card-copy"><small>{t(room ? "duel.roomInvite" : "duel.eyebrow")}</small><ActivityTitle activity={{ key: "number-duel-2026", theme: "number_duel" }} title={t("duel.title")} /><span>{room ? `${room.name} · ${room.guest_name ?? t("duel.waitingPeer")}` : t("duel.subtitle")}</span></span>
    <span className="duel-card-code" aria-hidden="true"><b>0</b><b>?</b><b>2</b><b>?</b></span>
    <span className="duel-card-footer"><span>{t(room ? "duel.roomSync" : "duel.week")}</span><span>{t(room ? room.status === "waiting" ? "duel.enterRoom" : room.status === "finished" ? "duel.roomEnded" : "duel.roomStarted" : "message.activityOpen")} <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></span></span>
  </button>;
}
