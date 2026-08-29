import { useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { FriendOperatorDTO, UserDTO } from "../types";
import { QuietState } from "./BoundaryState";
import { SideDrawer } from "./SideDrawer";
import { UserAvatar } from "./UserAvatar";

export function AddFriendDrawer({ open, onClose, onRouteOpen }: { open: boolean; onClose: () => void; onRouteOpen?: () => void }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [result, setResult] = useState<{ user: UserDTO | null; relationship: "none" | "pending" | "friend" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [operators, setOperators] = useState<FriendOperatorDTO[]>([]);
  const [operatorBusyId, setOperatorBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    api.getFriendOperators(controller.signal).then(setOperators).catch(() => setOperators([]));
    return () => controller.abort();
  }, [open]);

  const search = async () => {
    const normalized = name.trim();
    if (!normalized || busy) return;
    setBusy(true);
    try {
      setResult(await api.searchFriendExact(normalized));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("friendSearch.failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  const addOperator = async (operator: FriendOperatorDTO) => {
    try {
      setOperatorBusyId(operator.user.user_id);
      await api.createOperatorFriendRequest(operator.user.user_id);
      setOperators((current) => current.map((item) => item.user.user_id === operator.user.user_id ? { ...item, relationship: "pending" } : item));
      showToast(t("profile.requestSent"));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("profile.sendFailed"), "error");
    } finally {
      setOperatorBusyId(null);
    }
  };

  const send = async () => {
    if (!result?.user || busy) return;
    setBusy(true);
    try {
      await api.createFriendRequest(result.user.user_id, "search");
      setResult({ ...result, relationship: "pending" });
      showToast(t("profile.requestSent"));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("profile.sendFailed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SideDrawer historyKey="add-friend" onRouteOpen={onRouteOpen} onClose={onClose} open={open} title={t("friendSearch.title")}>
      <div className="friend-search-panel">
        {!session?.user.verified && !operators.length ? (
          <QuietState icon="verified_user" title={t("friendSearch.verifyFirst")} description={t("friendSearch.verifyHint")} />
        ) : (
          <>
            {session?.user.verified ? <form className="friend-search-form" onSubmit={(event) => { event.preventDefault(); void search(); }}>
              <label>
                <span className="material-symbols-outlined">person_search</span>
                <input autoComplete="off" onChange={(event) => { setName(event.target.value); setResult(null); }} placeholder={t("friendSearch.placeholder")} value={name} />
              </label>
              <button aria-label={t("friendSearch.search")} disabled={!name.trim() || busy} type="submit">
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </form> : null}
            {result ? result.user ? (
              <div className="friend-search-result">
                <UserAvatar className="friend-search-avatar" frame={result.user.avatar_frame_style} name={result.user.name} uri={result.user.avatar_uri} />
                <div><strong>{result.user.name}</strong><small>{t("friendSearch.exactMatch")}</small></div>
                {result.relationship === "none" ? <button className="button" disabled={busy} onClick={() => void send()} type="button">{t("profile.addFriend")}</button> : <span className="friend-search-state">{t(result.relationship === "friend" ? "friendSearch.alreadyFriend" : "friendSearch.pending")}</span>}
              </div>
            ) : <QuietState icon="person_off" title={t("friendSearch.notFound")} description={t("friendSearch.notFoundHint")} /> : !operators.length && session?.user.verified ? (
              <div className="friend-search-intro"><span className="material-symbols-outlined">fingerprint</span><strong>{t("friendSearch.exactOnly")}</strong><p>{t("friendSearch.exactOnlyHint")}</p></div>
            ) : null}
            {operators.length && name.length === 0 && result === null ? <section className="friend-operator-section"><header><strong>{t("friendSearch.operators")}</strong><small>{t("friendSearch.operatorsHint")}</small></header><div>{operators.map((operator) => <div className="friend-search-result" key={operator.user.user_id}><UserAvatar className="friend-search-avatar" frame={operator.user.avatar_frame_style} name={operator.user.name} uri={operator.user.avatar_uri} /><div><strong>{operator.user.name}</strong><small>{t("friendSearch.exactMatch")}</small></div>{operator.relationship === "none" ? <button className="button" disabled={operatorBusyId === operator.user.user_id} onClick={() => void addOperator(operator)} type="button">{t("profile.addFriend")}</button> : <span className="friend-search-state">{operator.relationship === "self" ? t("friendSearch.self") : operator.relationship === "friend" ? t("friendSearch.alreadyFriend") : t("friendSearch.pending")}</span>}</div>)}</div></section> : null}
          </>
        )}
      </div>
    </SideDrawer>
  );
}
