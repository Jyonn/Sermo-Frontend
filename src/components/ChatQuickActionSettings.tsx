import { useRef, useState, type PointerEvent } from "react";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { CHAT_ACTIONS_BY_KIND, actionsForKind, reorderChatActions, type ChatActionKind, type ChatQuickAction } from "../lib/chatQuickActions";
import { useChatQuickActions } from "../lib/useChatQuickActions";
import { showToast } from "../lib/toast";
import { DrawerTabs } from "./DrawerTabs";
import { ChatActionIcon } from "./ChatActionIcon";
import {CallShortcutDiscoveryMarker} from '../lib/callShortcutDiscovery';
import "./ChatQuickActions.css";
const labels = { locked: "pin.label", calendar: "chronelle.chatCalendar", copy: "copyShelf.title", status: "quickActions.status", search: "messageSearch.action", call: "voice.title" } as const;
export function ChatQuickActionSettings() {
  const { session } = useAuth(); const { t } = useI18n();
  const [kind, setKind] = useState<ChatActionKind>("direct");
  const { actions, save, ready } = useChatQuickActions(session ? `${session.user.space_id}:${session.user.user_id}` : '', kind);
  const [saving,setSaving]=useState(false);
  const [draft, setDraft] = useState<ChatQuickAction[] | null>(null);
  const [dragging, setDragging] = useState<ChatQuickAction | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: ChatQuickAction; items: ChatQuickAction[]; pointerId: number } | null>(null);
  const shown = draft ?? actions;
  const available = CHAT_ACTIONS_BY_KIND[kind].filter(key => !actions.includes(key));
  const defaults = actionsForKind(null, kind);
  const isDefault = actions.length === defaults.length && actions.every((key, index) => key === defaults[index]);
  const update = async (next: ChatQuickAction[]) => { setSaving(true);try{if (!await save(next)) showToast(t("common.saveFailed"), "error")}finally{setSaving(false)} };
  function startDrag(event: PointerEvent<HTMLButtonElement>, key: ChatQuickAction) {
    if (!event.isPrimary || event.button !== 0 || !list.current) return;
    event.preventDefault();
    list.current.setPointerCapture(event.pointerId);
    drag.current = {key, items: actions, pointerId: event.pointerId};
    setDragging(key);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-action]");
    if (!target || !event.currentTarget.contains(target)) return;
    const next = reorderChatActions(current.items, current.key, target.dataset.action as ChatQuickAction);
    if (next === current.items) return;
    current.items = next;
    setDraft(next);
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(null);
    setDraft(null);
    if (commit && current.items.some((key, index) => key !== actions[index])) void update(current.items);
  }
  return <fieldset className="quick-action-settings" aria-busy={!ready || saving} disabled={!ready || saving}>
    <DrawerTabs label={t("quickActions.title")} value={kind} items={[{ value: "direct", label: t("quickActions.direct") }, { value: "group", label: t("quickActions.group") }]} onChange={value => { setKind(value); setDraft(null); setDragging(null); drag.current = null; }} />
    <div className="quick-settings-preview" aria-hidden="true">
      <div className="quick-settings-heading"><span>{t("quickActions.preview")}</span><span className="quick-settings-count">{shown.length} / 4</span></div>
      <div className="quick-settings-preview-bar">{shown.map(key => <span key={key} data-action={key}><ChatActionIcon action={key}/></span>)}</div>
    </div>
    <section className="quick-settings-section">
    <div className="quick-settings-heading">
      <h3>{t("quickActions.selected")}</h3>
      <button className="quick-settings-reset" type="button" disabled={isDefault || dragging !== null} onClick={() => update(defaults)}>{t("quickActions.reset")}</button>
    </div>
    <div className="quick-settings-list" ref={list} role="list" aria-label={t("quickActions.order")}
      onPointerMove={moveDrag} onPointerUp={event => finishDrag(event, true)}
      onPointerCancel={event => finishDrag(event, false)} onLostPointerCapture={event => finishDrag(event, false)}>
      {shown.map(key => <div className={"quick-settings-row" + (dragging === key ? " is-dragging" : "")} key={key} data-action={key} role="listitem">
        <button className="quick-settings-grip" type="button" aria-label={t("quickActions.dragHint") + " · " + t(labels[key])}
          onPointerDown={event => startDrag(event, key)}
          onKeyDown={event => {
            const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
            if (!delta) return;
            event.preventDefault();
            const target = actions[actions.indexOf(key) + delta];
            if (target) void update(reorderChatActions(actions, key, target));
          }}><svg viewBox="0 0 16 24" aria-hidden="true">{[5,11].flatMap(x => [6,12,18].map(y => <circle key={x + ":" + y} cx={x} cy={y} r="1.3"/>))}</svg></button>
        <ChatActionIcon action={key}/><strong className="quick-settings-action-label">{t(labels[key])}{key==='call'?<CallShortcutDiscoveryMarker/>:null}</strong>
        <button className="quick-settings-remove" type="button" disabled={actions.length === 1 || dragging !== null} aria-label={t("quickActions.remove") + " " + t(labels[key])} onClick={() => update(actions.filter(item => item !== key))}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 10h8"/></svg></button>
      </div>)}
    </div>
    {shown.length > 1 && <p className="quick-settings-hint">{t("quickActions.dragHint")}</p>}
    </section>
    {available.length > 0 && <section className="quick-settings-section">
      <div className="quick-settings-heading"><h3>{t("quickActions.available")}</h3></div>
      <div className="quick-settings-additions">
        {available.map(key => <button key={key} type="button" disabled={actions.length >= 4 || dragging !== null} onClick={() => update([...actions, key])}>
          <ChatActionIcon action={key}/>
          <span className="quick-settings-action-label">{t(labels[key])}{key === "call" ? <CallShortcutDiscoveryMarker/> : null}</span>
          <span className="quick-settings-plus" aria-hidden="true">+</span>
        </button>)}
      </div>
    </section>}
  </fieldset>;
}
