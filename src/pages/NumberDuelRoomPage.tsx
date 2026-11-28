import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import type { ActivityCampaignDTO } from "../types";
import { ActivityTitle } from "../components/ActivityCampaignCard";
import { NumberDuelActivity } from "../components/NumberDuelActivity";
import "./NumberDuelRoomPage.css";

export default function NumberDuelRoomPage() {
  const { roomCode = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [activity, setActivity] = useState<ActivityCampaignDTO | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [share, setShare] = useState(0);
  const [gameHeader,setGameHeader] = useState<HTMLDivElement|null>(null);
  const gameExit = useRef<((after?: () => void) => void)>();
  const back = () => navigate("/app/menu?panel=activities&activity=number-duel-2026");
  const minimize = () => navigate(location.state?.gameRoomReturn ?? "/app/menu?panel=activities", {replace:true});
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    api.getActivity("number-duel-2026", controller.signal).then(setActivity).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [retry]);
  return <main className="duel-room-page game-table-screen">
    <header className="duel-room-header">
      <button type="button" className="duel-room-back" aria-label={t("duel.backLobby")} onClick={() => gameExit.current ? gameExit.current(back) : back()}><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span></button>
      <ActivityTitle activity={{ key: "number-duel-2026", theme: "number_duel" }} title={t("duel.title")} />
      <button type="button" className="duel-room-share" aria-label={t("duel.invite")} disabled={!activity} onClick={() => setShare((value) => value + 1)}><span className="material-symbols-outlined" aria-hidden="true">share</span></button>
      <div className="game-room-header-slot" ref={setGameHeader} />
    </header>
    <div className="duel-room-surface">{activity ? <NumberDuelActivity key={roomCode} activity={activity} roomCode={roomCode}
      shareRequest={share} exitHandler={gameExit} onMinimize={minimize} headerTarget={gameHeader} onExitRoom={back} /> : <div className="duel-room-entry"><p role="status">{t(failed ? "duel.error.closed" : "common.loading")}</p>{failed ? <button type="button" className="ghost-button" onClick={() => setRetry((value) => value + 1)}>{t("duel.retry")}</button> : null}</div>}</div>
  </main>;
}
