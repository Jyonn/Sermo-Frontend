import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import { ActivityTitle } from "../components/ActivityCampaignCard";
import { NumberDuelActivity } from "../components/NumberDuelActivity";
import "./NumberDuelRoomPage.css";

export default function NumberDuelRoomPage() {
  const { roomCode = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [activity, setActivity] = useState<ActivityCampaignDTO | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [share, setShare] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    api.getActivity("number-duel-2026", controller.signal).then(setActivity).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [retry]);
  return <main className="duel-room-page">
    <header className="duel-room-header"><button type="button" className="duel-room-back" aria-label={t("duel.backLobby")} onClick={() => navigate("/app/square/activities/number-duel-2026")}><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span></button><ActivityTitle activity={{ key: "number-duel-2026", theme: "number_duel" }} title={t("duel.title")} /><button type="button" className="duel-room-share" aria-label={t("duel.invite")} disabled={!activity} onClick={() => setShare((value) => value + 1)}><span className="material-symbols-outlined" aria-hidden="true">share</span></button></header>
    <div className="duel-room-surface">{activity ? <NumberDuelActivity key={roomCode} activity={activity} roomCode={roomCode} shareRequest={share} /> : <div className="duel-room-entry"><p role="status">{t(failed ? "duel.error.closed" : "common.loading")}</p>{failed ? <button type="button" className="ghost-button" onClick={() => setRetry((value) => value + 1)}>{t("duel.retry")}</button> : null}</div>}</div>
  </main>;
}
