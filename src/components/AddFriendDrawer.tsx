import { useState } from "react";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { UserDTO } from "../types";
import { QuietState } from "./BoundaryState";
import { SideDrawer } from "./SideDrawer";
import { UserAvatar } from "./UserAvatar";

export function AddFriendDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [result, setResult] = useState<{ user: UserDTO | null; relationship: "none" | "pending" | "friend" } | null>(null);
  const [busy, setBusy] = useState(false);

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
    <SideDrawer historyKey="add-friend" onClose={onClose} open={open} title={t("friendSearch.title")}>
      <div className="friend-search-panel">
        {!session?.user.verified ? (
          <QuietState icon="verified_user" title={t("friendSearch.verifyFirst")} description={t("friendSearch.verifyHint")} />
        ) : (
          <>
            <form className="friend-search-form" onSubmit={(event) => { event.preventDefault(); void search(); }}>
              <label>
                <span className="material-symbols-outlined">person_search</span>
                <input autoComplete="off" onChange={(event) => { setName(event.target.value); setResult(null); }} placeholder={t("friendSearch.placeholder")} value={name} />
              </label>
              <button aria-label={t("friendSearch.search")} disabled={!name.trim() || busy} type="submit">
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </form>
            {result ? result.user ? (
              <div className="friend-search-result">
                <UserAvatar className="friend-search-avatar" frame={result.user.avatar_frame_style} name={result.user.name} uri={result.user.avatar_uri} />
                <div><strong>{result.user.name}</strong><small>{t("friendSearch.exactMatch")}</small></div>
                {result.relationship === "none" ? <button className="button" disabled={busy} onClick={() => void send()} type="button">{t("profile.addFriend")}</button> : <span className="friend-search-state">{t(result.relationship === "friend" ? "friendSearch.alreadyFriend" : "friendSearch.pending")}</span>}
              </div>
            ) : <QuietState icon="person_off" title={t("friendSearch.notFound")} description={t("friendSearch.notFoundHint")} /> : (
              <div className="friend-search-intro"><span className="material-symbols-outlined">fingerprint</span><strong>{t("friendSearch.exactOnly")}</strong><p>{t("friendSearch.exactOnlyHint")}</p></div>
            )}
          </>
        )}
      </div>
    </SideDrawer>
  );
}
