import { useRef, useState, type PointerEvent } from "react";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { CHAT_ACTIONS_BY_KIND, actionsForKind, reorderChatActions, type ChatActionKind, type ChatQuickAction } from "../lib/chatQuickActions";
import { useChatQuickActions } from "../lib/useChatQuickActions";
import { showToast } from "../lib/toast";
import { DrawerTabs } from "./DrawerTabs";
import { ChatActionIcon } from "./ChatActionIcon";
import "./ChatQuickActions.css";
const labels = { locked: "pin.label", calendar: "chronelle.chatCalendar", copy: "copyShelf.title", status: "quickActions.status", search: "messageSearch.action" } as const;
export function ChatQuickActionSettings() {
  const { session } = useAuth(); const { t } = useI18n();
  const [kind, setKind] = useState<ChatActionKind>("direct");
  const { actions, save } = useChatQuickActions(String(session?.user.space_id) + ":" + String(session?.user.user_id), kind);
  const [draft, setDraft] = useState<ChatQuickAction[] | null>(null);
  const [dragging, setDragging] = useState<ChatQuickAction | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: ChatQuickAction; items: ChatQuickAction[]; pointerId: number } | null>(null);
  const shown = draft ?? actions;
  const update = (next: ChatQuickAction[]) => { if (!save(next)) showToast(t("common.saveFailed"), "error"); };
  const finish = (event: PointerEvent<HTMLButtonElement>, commit: boolean) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    if (commit) update(drag.current.items);
    drag.current = null; setDragging(null); setDraft(null);
  };
  return <div className="quick-action-settings">
    <DrawerTabs label={t("quickActions.title")} value={kind} items={[{ value: "direct", label: t("quickActions.direct") }, { value: "group", label: t("quickActions.group") }]} onChange={value => { setKind(value); setDraft(null); setDragging(null); drag.current = null; }} />
    <div className="quick-settings-preview" aria-hidden="true"><div className="quick-settings-preview-heading"><span>{t("quickActions.preview")}</span><span>{shown.length} / 4</span></div><div className="quick-settings-preview-bar">{shown.map(key => <span key={key} data-action={key}><ChatActionIcon action={key}/>{key === "status" ? <b>8</b> : null}</span>)}</div><i/><i/></div>
    <div className="quick-settings-heading"><strong>{t("quickActions.selected")}</strong><span>{t("quickActions.dragHint")}</span></div>
    <div className="quick-settings-list" ref={list} role="list" aria-label={t("quickActions.order")}>
      {shown.map(key => <div className={"quick-settings-row" + (dragging === key ? " is-dragging" : "")} key={key} data-action={key} role="listitem">
        <button className="quick-settings-grip" type="button" aria-label={t("quickActions.dragHint") + " · " + t(labels[key])} onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { key, items: [...actions], pointerId: event.pointerId }; setDraft([...actions]); setDragging(key); }} onPointerMove={event => {
          const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-action]");
          if (!target || !list.current?.contains(target)) return;
          const next = reorderChatActions(current.items, current.key, target.dataset.action as ChatQuickAction);
          if (next !== current.items) { current.items = next; setDraft(next); }
        }} onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)} onKeyDown={event => { const index = actions.indexOf(key), delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0; if (!delta) return; event.preventDefault(); const target = actions[index + delta]; if (target) update(reorderChatActions(actions, key, target)); }}><svg viewBox="0 0 16 24" aria-hidden="true">{[5,11].flatMap(x => [6,12,18].map(y => <circle key={x + ":" + y} cx={x} cy={y} r="1.3"/>))}</svg></button>
        <ChatActionIcon action={key}/><strong>{t(labels[key])}</strong>
        <button className="quick-settings-remove" type="button" disabled={actions.length === 1 || dragging !== null} aria-label={t("quickActions.remove") + " " + t(labels[key])} onClick={() => update(actions.filter(item => item !== key))}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 10h8"/></svg></button>
      </div>)}
    </div>
    {CHAT_ACTIONS_BY_KIND[kind].some(key => !actions.includes(key)) ? <><div className="quick-settings-heading"><strong>{t("quickActions.available")}</strong></div><div className="quick-settings-additions">{CHAT_ACTIONS_BY_KIND[kind].filter(key => !actions.includes(key)).map(key => <button key={key} type="button" disabled={actions.length >= 4 || dragging !== null} onClick={() => update([...actions, key])}><ChatActionIcon action={key}/><span>{t(labels[key])}</span><b>+</b></button>)}</div></> : null}
    <button className="quick-settings-reset" type="button" onClick={() => update(actionsForKind(null, kind))}>{t("quickActions.reset")}</button>
  </div>;
}
