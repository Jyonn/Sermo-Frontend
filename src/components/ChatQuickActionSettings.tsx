import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { CHAT_ACTION_OPTIONS, DEFAULT_CHAT_ACTIONS, type ChatQuickAction } from "../lib/chatQuickActions";
import { useChatQuickActions } from "../lib/useChatQuickActions";
import { showToast } from "../lib/toast";
import { SettingSwitch } from "./SettingRow";
import "./ChatQuickActions.css";
export const chatActionIcons = { locked: "lock", calendar: "calendar_month", copy: "content_copy", status: "group", search: "search" };
export const chatActionLabels = { locked: "pin.label", calendar: "chronelle.chatCalendar", copy: "copyShelf.title", status: "quickActions.status", search: "messageSearch.action" } as const;
export function ChatQuickActionSettings() {
  const { session } = useAuth(); const { t } = useI18n();
  const { actions, save } = useChatQuickActions(`${session?.user.space_id}:${session?.user.user_id}`);
  const update = (next: ChatQuickAction[]) => { if (!save(next)) showToast(t("common.saveFailed"), "error"); };
  const move = (index: number, delta: number) => { const next = [...actions]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; update(next); };
  return <div className="quick-action-settings"><p>{t("quickActions.settingsHint")}</p>
    {CHAT_ACTION_OPTIONS.map(key => <div className="quick-action-setting" key={key}><span className="material-symbols-outlined">{chatActionIcons[key]}</span><strong>{t(chatActionLabels[key])}</strong><SettingSwitch label={t(chatActionLabels[key])} checked={actions.includes(key)} disabled={(actions.length === 1 && actions.includes(key)) || (actions.length === 4 && !actions.includes(key))} onChange={enabled => update(enabled ? [...actions, key] : actions.filter(item => item !== key))} /></div>)}
    <h3>{t("quickActions.order")}</h3>
    {actions.map((key, index) => <div className="quick-action-setting" key={key}><span>{index + 1}</span><strong>{t(chatActionLabels[key])}</strong><button type="button" aria-label={`${t("quickActions.moveUp")} ${t(chatActionLabels[key])}`} disabled={index === 0} onClick={() => move(index, -1)}><span className="material-symbols-outlined">arrow_upward</span></button><button type="button" aria-label={`${t("quickActions.moveDown")} ${t(chatActionLabels[key])}`} disabled={index === actions.length - 1} onClick={() => move(index, 1)}><span className="material-symbols-outlined">arrow_downward</span></button></div>)}
    <button className="ghost-button" type="button" onClick={() => update([...DEFAULT_CHAT_ACTIONS])}>{t("quickActions.reset")}</button>
  </div>;
}
