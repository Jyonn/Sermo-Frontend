import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import {
  calendarVisibilityModes,
  inheritedFriendCalendarPolicy,
  permissionMode,
  type CalendarVisibility,
  type ChronelleFriendException,
  type ChronelleFriendSharing,
  type FriendCalendarPolicy,
} from "../lib/chronellePermissions";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import { ContentLoader, QuietState } from "./BoundaryState";
import { FloatingDrawerScope } from "./DesktopPanelWorkspace";
import { SideDrawer } from "./SideDrawer";
import { SettingGroup, SettingRow, SettingSelect } from "./SettingRow";
import { PlainAvatar } from "./UserAvatar";
import "./ChronellePluginDialog.css";

const savedEvent = "chronelle:permissions-saved";

function ChronelleFriendEditor({ friendId, onClose, onConnect }: {
  friendId: number;
  onClose: () => void;
  onConnect: () => void;
}) {
  const { t } = useI18n();
  const [setup, setSetup] = useState<ChronelleFriendSharing | null>(null);
  const [draft, setDraft] = useState<FriendCalendarPolicy>(inheritedFriendCalendarPolicy);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const modeLabel = (mode: CalendarVisibility) => t(`chronelle.friendSharing.${mode}`);
  const options = calendarVisibilityModes.map(value => ({ value, label: modeLabel(value) }));
  const dirty = Boolean(setup?.policy) && JSON.stringify(setup?.policy) !== JSON.stringify(draft);
  const custom = draft.default !== null || Object.keys(draft.overrides).length > 0;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api.chronelleFriendSharing(friendId, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setSetup(value);
      setDraft(value.policy ?? inheritedFriendCalendarPolicy);
    }).catch(cause => {
      if (!controller.signal.aborted) {
        setError(t(cause instanceof ApiError && cause.status === 404
          ? "chronelle.friendSharing.notFriend" : "chronelle.permissions.loadFailed"));
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [friendId, retry, t]);

  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.saveChronelleFriendSharing(friendId, draft);
      window.dispatchEvent(new Event(savedEvent));
      showToast(t(result.rebind_required ? "chronelle.permissions.rebindRequired" : "chronelle.friendSharing.saved"));
      onClose();
      if (result.rebind_required) onConnect();
    } catch (cause) {
      setError(t(cause instanceof ApiError && cause.status === 404
        ? "chronelle.friendSharing.notFriend" : "chronelle.permissions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  const inherited = setup?.inherited;
  return <FloatingDrawerScope>
    <SideDrawer open onClose={() => { if (!busy) onClose(); }} showTitle title={t("chronelle.friendSharing.editorTitle")}>
      <div className="chronelle-permissions-content">
        {loading ? <ContentLoader label={t("common.loading")} rows={3} />
          : setup?.status === "active" && setup.friend && inherited ? <>
            <div className="chronelle-friend-identity">
              <PlainAvatar className="mini-avatar" name={setup.friend.name} uri={setup.friend.avatar_uri} cacheKey={setup.friend.avatar_cache_key} />
              <div><strong>{setup.friend.name}</strong><p>{t("chronelle.friendSharing.editorHint")}</p></div>
            </div>
            <SettingGroup>
              <SettingSelect label={t("chronelle.friendSharing.allGroups")} value={draft.default ?? "inherit"}
                disabled={busy} options={[
                  { value: "inherit", label: t("chronelle.friendSharing.inherit") }, ...options,
                ]} onChange={value => setDraft(current => ({ ...current, default: value === "inherit" ? null : value }))} />
            </SettingGroup>
            {Boolean(setup.groups?.length) && <>
              <h3>{t("chronelle.permissions.groups")}</h3>
              <SettingGroup>{setup.groups?.map(group => {
                const inheritedMode = draft.default ?? permissionMode(inherited, group.id);
                return <SettingSelect key={group.id} label={group.name} disabled={busy} value={draft.overrides[group.id] ?? "inherit"}
                  options={[{ value: "inherit", label: t("chronelle.friendSharing.inheritsMode", { mode: modeLabel(inheritedMode) }) }, ...options]}
                  onChange={value => setDraft(current => {
                    const overrides = { ...current.overrides };
                    if (value === "inherit") delete overrides[group.id];
                    else overrides[group.id] = value;
                    return { ...current, overrides };
                  })} />;
              })}</SettingGroup>
            </>}
            <p className="chronelle-permissions-hint">{t("chronelle.friendSharing.fieldsHint")}</p>
            {error && <p className="chronelle-permissions-error" role="alert">{error}</p>}
            <div className="chronelle-friend-footer">
              {custom && <button className="ghost-button" type="button" disabled={busy}
                onClick={() => setDraft(inheritedFriendCalendarPolicy)}>{t("chronelle.friendSharing.restore")}</button>}
              <button className="button" type="button" disabled={!dirty || busy}
                onClick={() => void save()}>{t(busy ? "common.processing" : "common.save")}</button>
            </div>
          </> : <QuietState icon="calendar_month" title={error || t("chronelle.permissions.unavailable")}
            action={error ? <button className="ghost-button" type="button" onClick={() => setRetry(current => current + 1)}>{t("common.retry")}</button>
              : <button className="button" type="button" onClick={() => { onClose(); onConnect(); }}>{t("chronelle.bind")}</button>} />}
      </div>
    </SideDrawer>
  </FloatingDrawerScope>;
}

export function ChronelleChatFriendSharing({ friendId, onConnect }: { friendId: number; onConnect: () => void }) {
  const { t } = useI18n();
  const [isFriend, setIsFriend] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api.getFriendStatus(friendId, controller.signal).then(status => {
      if (!controller.signal.aborted) setIsFriend(status.is_friend);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [friendId]);
  if (!isFriend) return null;
  return <section className="chat-detail-settings-section">
    <SettingGroup><SettingRow icon={<span className="material-symbols-outlined" aria-hidden="true">event_available</span>}
      title={t("chronelle.friendSharing.chatEntry")} description={t("chronelle.friendSharing.editorHint")}
      onClick={() => setEditing(true)} /></SettingGroup>
    {editing && <ChronelleFriendEditor friendId={friendId} onClose={() => setEditing(false)} onConnect={onConnect} />}
  </section>;
}

export function ChronelleFriendExceptions({ onConnect }: { onConnect: () => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<ChronelleFriendException[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(current => current + 1);
    window.addEventListener(savedEvent, refresh);
    window.addEventListener("chronelle:bound", refresh);
    return () => {
      window.removeEventListener(savedEvent, refresh);
      window.removeEventListener("chronelle:bound", refresh);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    api.chronelleFriendExceptions(controller.signal).then(value => {
      if (!controller.signal.aborted) setRows(value.friends);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [revision]);
  return <section className="chronelle-friend-exceptions">
    <h3>{t("chronelle.friendSharing.exceptionsTitle")}</h3>
    {failed ? <SettingGroup><SettingRow title={t("chronelle.permissions.loadFailed")} value={t("common.retry")}
      onClick={() => setRevision(current => current + 1)} /></SettingGroup>
      : rows === null ? <ContentLoader label={t("common.loading")} variant="compact" />
      : rows.length === 0 ? <p className="chronelle-permissions-hint">{t("chronelle.friendSharing.empty")}</p>
      : <SettingGroup>{rows.map(({ friend, policy }) => <SettingRow key={friend.user_id}
        icon={<PlainAvatar className="mini-avatar" name={friend.name} uri={friend.avatar_uri} cacheKey={friend.avatar_cache_key} />}
        title={friend.name}
        value={Object.keys(policy.overrides).length ? t("chronelle.friendSharing.byGroup")
          : t(`chronelle.friendSharing.${policy.default ?? "inherit"}`)}
        onClick={() => setSelected(friend.user_id)} />)}</SettingGroup>}
    {selected !== null && <ChronelleFriendEditor key={selected} friendId={selected} onClose={() => setSelected(null)} onConnect={onConnect} />}
  </section>;
}
