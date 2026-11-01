import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n, localeForLanguage } from '../lib/language';
import { showToast } from '../lib/toast';
import { historyDay, historyDayRange, historyTypeOptions, rangeSelection, selectionInRectangle, type HistoryFilters } from '../lib/historyManagement';
import type { HistoryManagementPageDTO, ManagedMessageDTO } from '../types';
import { CompactMessageContent } from '../components/CompactMessageContent';
import { ConfirmDialog } from '../components/ConfirmDialog';
import './HistoryManagerPage.css';

type DeletePlan = { filters: HistoryFilters; ids: number[]; count: number; retained: number };
const symbol = (name: string) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;

export default function HistoryManagerPage({ chatId: embeddedChatId, onClose, onChanged }: { chatId?: number; onClose?: () => void; onChanged?: () => void } = {}) {
  const { chatId } = useParams(); const id = embeddedChatId ?? Number(chatId);
  const { session } = useAuth(); const { t, language } = useI18n();
  const scope = `${session?.user.space_id}:${session?.user.user_id}:${id}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const [keyword, setKeyword] = useState(''), [types, setTypes] = useState<string[]>([]);
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [onlyRetained, setOnlyRetained] = useState(false);
  const [page, setPage] = useState<HistoryManagementPageDTO | null>(null), [rows, setRows] = useState<ManagedMessageDTO[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set()), [loading, setLoading] = useState(true), [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [version, setVersion] = useState(0);
  const [plan, setPlan] = useState<DeletePlan | null>(null), [deleted, setDeleted] = useState(0);
  const anchor = useRef<number | null>(null), stop = useRef(false), moreRequest = useRef(false);
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{x:number;y:number;pointer:number;base:Set<number>;active:boolean;lastX:number;lastY:number} | null>(null);
  const moved = useRef(false), frame = useRef(0);
  const [rectangle, setRectangle] = useState<{left:number;top:number;right:number;bottom:number} | null>(null);
  const [dragMode, setDragMode] = useState(false);
  const invalidDates = Boolean(from && to && from > to);
  const filters = useMemo<HistoryFilters>(() => ({ chat_id: id, keyword: keyword.trim() || undefined,
    types: types.length ? [...new Set(types.flatMap(type => type.split(',')))].join(',') : undefined,
    start: from ? historyDayRange(from).start : undefined, end: to ? historyDayRange(to).end : undefined,
    retained: onlyRetained ? 1 : 0 }), [id, keyword, types, from, to, onlyRetained]);
  const filterRef = useRef(filters); filterRef.current = filters;
  const currentFilters = () => ({ ...filters, snapshot: page?.snapshot_id });
  useEffect(() => {
    stop.current = false;
    return () => { stop.current = true; cancelAnimationFrame(frame.current); };
  }, [scope]);
  useEffect(() => {
    const controller = new AbortController();
    setSelected(new Set()); anchor.current = null; setPage(null); setRows([]); setError(''); setLoading(true);
    if (invalidDates || !Number.isSafeInteger(id) || id <= 0) { setLoading(false); return () => controller.abort(); }
    const timer = window.setTimeout(() => {
      api.getManagedHistory(filters, controller.signal).then(result => {
        if (!controller.signal.aborted) { setPage(result); setRows(result.items); }
      }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : t('historyManager.failed')); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 240);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [filters, scope, version, invalidDates, id, t]);
  const groups = useMemo(() => {
    const days = new Map<string, ManagedMessageDTO[]>();
    rows.forEach(row => { const key = historyDay(row.created_at); const group = days.get(key) || []; group.push(row); days.set(key, group); });
    return [...days];
  }, [rows]);
  const fail = (reason: unknown) => showToast(reason instanceof Error ? reason.message : t('historyManager.failed'), 'error');
  const setSelection = (ids: Set<number>) => {
    if (ids.size > 500) { showToast(t('historyManager.selectionLimit'), 'error'); return; }
    setSelected(ids);
  };
  const toggle = (messageId: number, shift: boolean) => {
    const next = new Set(selected);
    if (shift) rangeSelection(rows.map(row => row.message_id), anchor.current, messageId).forEach(value => next.add(value));
    else if (next.has(messageId)) next.delete(messageId); else next.add(messageId);
    anchor.current = messageId; setSelection(next);
  };
  const loadMore = async () => {
    if (!page?.has_more || !page.next_before || moreRequest.current || busy) return;
    const requestScope = scope, requestFilters = filters; moreRequest.current = true; setMoreLoading(true);
    try {
      const result = await api.getManagedHistory({ ...currentFilters(), before: page.next_before });
      if (scopeRef.current !== requestScope || filterRef.current !== requestFilters) return;
      setPage(result); setRows(current => { const ids = new Set(current.map(row => row.message_id)); return [...current, ...result.items.filter(row => !ids.has(row.message_id))]; });
    } catch (reason) { fail(reason); } finally { moreRequest.current = false; setMoreLoading(false); }
  };
  const previewDelete = async (ids: number[], day?: string) => {
    if (!page || busy) return;
    let query = currentFilters();
    if (day) { const range = historyDayRange(day); query = { ...query, start: Math.max(query.start ?? 0, range.start), end: Math.min(query.end ?? Infinity, range.end) }; }
    const operationScope = scope; setBusy(true);
    try {
      const result = await api.manageHistory(query, 'preview', ids);
      if (scopeRef.current !== operationScope) return;
      if (!result.deletable_count) { showToast(t('historyManager.nothingToDelete')); return; }
      setPlan({ filters: query, ids, count: result.deletable_count, retained: result.retained_count ?? 0 });
    } catch (reason) { fail(reason); } finally { setBusy(false); }
  };
  const executeDelete = async () => {
    if (!plan || busy) return;
    const operationScope = scope, pending = plan; stop.current = false; setBusy(true); setDeleted(0); let count = 0;
    try {
      let remaining = 1;
      while (remaining > 0 && !stop.current && scopeRef.current === operationScope) {
        const result = await api.manageHistory(pending.filters, 'delete', pending.ids);
        count += result.changed_ids?.length ?? 0; setDeleted(count);
        remaining = pending.ids.length ? 0 : (result.remaining ?? 0);
        if (!result.changed_ids?.length) break;
      }
      if (scopeRef.current === operationScope) showToast(t('historyManager.deleted', { count }));
    } catch (reason) { fail(reason); }
    finally { if (scopeRef.current === operationScope) { setBusy(false); setPlan(null); setVersion(value => value + 1); if (count) onChanged?.(); } }
  };
  const protect = async (release: boolean) => {
    if (!selected.size || busy) return;
    const operationScope = scope; setBusy(true);
    try { await api.manageHistory(currentFilters(), release ? 'release' : 'retain', [...selected]);
      if (scopeRef.current === operationScope) { setVersion(value => value + 1); showToast(t(release ? 'historyManager.released' : 'historyManager.retained')); }
    } catch (reason) { fail(reason); } finally { setBusy(false); }
  };
  const updateDrag = () => {
    const state = drag.current; if (!state?.active || !board.current) return;
    const box = { left: Math.min(state.x,state.lastX), top: Math.min(state.y,state.lastY), right: Math.max(state.x,state.lastX), bottom: Math.max(state.y,state.lastY) };
    setRectangle(box);
    const bounds = [...board.current.querySelectorAll<HTMLElement>('[data-record]')].map(element => ({ id: Number(element.dataset.record), ...element.getBoundingClientRect().toJSON() }));
    const hits = selectionInRectangle(box, bounds); const next = new Set(state.base); hits.forEach(mid => next.add(mid));
    setSelected(next.size <= 500 ? next : new Set([...next].slice(0, 500)));
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current; if (!state || state.pointer !== event.pointerId) return;
    state.lastX = event.clientX; state.lastY = event.clientY;
    if (!state.active && Math.hypot(event.clientX - state.x, event.clientY - state.y) > 6) {
      state.active = true; moved.current = true; event.currentTarget.setPointerCapture(event.pointerId);
      const scroll = () => {
        if (!drag.current?.active) return;
        const bounds = board.current?.getBoundingClientRect();
        if (bounds) { const y = drag.current.lastY; const delta = y < bounds.top + 48 ? -14 : y > bounds.bottom - 48 ? 14 : 0;
          if (delta) { const before = board.current!.scrollTop; board.current!.scrollTop += delta; drag.current.y -= board.current!.scrollTop - before; updateDrag(); }
        }
        frame.current = requestAnimationFrame(scroll);
      }; frame.current = requestAnimationFrame(scroll);
    }
    if (state.active) { event.preventDefault(); updateDrag(); }
  };
  const endDrag = () => { drag.current = null; cancelAnimationFrame(frame.current); setRectangle(null); };
  const preview = (message: ManagedMessageDTO) => {
    if (message.type === 0) return message.payload?.text || message.content;
    if ([3,12,13].includes(message.type)) return message.content || message.payload?.text || t('historyManager.system');
    if (message.type === 2) return message.payload?.file_name || t('media.file');
    return t(historyTypeOptions.find(option => option.types.split(',').includes(String(message.type)))?.key || 'messageSearch.text');
  };
  return <main className="history-manager" aria-busy={busy || loading}>
    <header className="history-manager-header">{onClose ? <button type="button" className="history-manager-back" disabled={busy} onClick={onClose} aria-label={t('common.back')}>{symbol('arrow_back')}</button> : <Link to={`/app/chats/${id}`} aria-label={t('common.back')}>{symbol('arrow_back')}</Link>}<div><h1>{t('historyManager.title')}</h1><p>{t('historyManager.privateHint')}</p></div><button type="button" className="history-refresh" disabled={busy || loading} onClick={() => setVersion(value => value + 1)} aria-label={t('historyManager.refresh')}>{symbol('refresh')}</button></header>
    <section className="history-manager-tools" aria-label={t('historyManager.filters')}><fieldset disabled={busy}>
      <div className="history-filter-line"><label className="history-search">{symbol('search')}<input type="search" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder={t('messageSearch.placeholder')} aria-label={t('messageSearch.placeholder')} /></label>
        <div className="history-date-range"><label><span>{t('historyManager.from')}</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><span aria-hidden="true">—</span><label><span>{t('historyManager.to')}</span><input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label></div>
      </div>
      <div className="history-types"><button type="button" aria-pressed={!types.length} onClick={() => setTypes([])}>{t('messageSearch.all')}</button>{historyTypeOptions.map(option => <button type="button" key={option.types} aria-pressed={types.includes(option.types)} onClick={() => setTypes(current => current.includes(option.types) ? current.filter(type => type !== option.types) : [...current, option.types])}>{symbol(option.icon)}{t(option.key)}</button>)}<button type="button" className="history-retained-filter" aria-pressed={onlyRetained} onClick={() => setOnlyRetained(value => !value)}>{symbol('keep')}{t('historyManager.retainedOnly')}</button></div>
    </fieldset></section>
    <div className="history-manager-summary"><span aria-live="polite">{loading ? t('common.loading') : t('historyManager.summary', { count: page?.total_count ?? 0, retained: page?.retained_count ?? 0 })}</span><button disabled={busy || loading || !page?.total_count} type="button" onClick={() => void previewDelete([])}>{symbol('delete_sweep')}{t('historyManager.cleanFiltered')}</button></div>
    <div className={`history-manager-board${dragMode ? ' is-drag-mode' : ''}`} ref={board} tabIndex={0} aria-label={t('historyManager.title')} onKeyDown={event => {
      if (event.key === 'Escape' && (selected.size || dragMode)) { event.preventDefault(); event.stopPropagation(); setSelected(new Set()); setDragMode(false); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); setSelection(new Set(rows.map(row => row.message_id))); }
    }} onPointerDown={event => {
      if (busy || (event.pointerType !== 'mouse' && !dragMode) || event.button !== 0 || (event.target as HTMLElement).closest('[data-no-drag]')) return;
      moved.current = false; drag.current = {x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,pointer:event.pointerId,base:event.ctrlKey || event.metaKey ? new Set(selected) : new Set(),active:false};
    }} onPointerMove={pointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onClickCapture={event => { if (moved.current) { event.preventDefault(); event.stopPropagation(); moved.current = false; } }}>
      {invalidDates ? <div className="history-empty" role="alert">{t('historyManager.invalidDates')}</div> : error ? <div className="history-empty" role="alert"><p>{error}</p><button type="button" onClick={() => setVersion(value => value + 1)}>{t('historyManager.retry')}</button></div> : loading ? <div className="history-skeleton" aria-label={t('common.loading')}>{Array.from({length:12},(_,index)=><i key={index}/>)}</div> : !rows.length ? <div className="history-empty">{symbol('manage_search')}<h2>{t('historyManager.empty')}</h2><p>{t('historyManager.emptyHint')}</p></div> : groups.map(([day, messages]) => <section className="history-day" key={day}>
        <header><h2>{new Intl.DateTimeFormat(localeForLanguage(language), { year:'numeric',month:'short',day:'numeric',weekday:'short',timeZone:'Asia/Shanghai' }).format(new Date(`${day}T12:00:00+08:00`))}</h2><div data-no-drag><button type="button" disabled={busy} onClick={() => { const next = new Set(selected); const all = messages.every(message => next.has(message.message_id)); messages.forEach(message => all ? next.delete(message.message_id) : next.add(message.message_id)); setSelection(next); }}>{t('historyManager.selectDay')}</button><button type="button" disabled={busy} onClick={() => void previewDelete([], day)} aria-label={t('historyManager.cleanDay')}>{symbol('delete_sweep')}</button></div></header>
        <div className="history-message-grid">{messages.map(message => <button type="button" data-record={message.message_id} key={message.message_id} disabled={busy} className={`history-record${selected.has(message.message_id) ? ' is-selected' : ''}${message.retained ? ' is-retained' : ''}`} aria-pressed={selected.has(message.message_id)} onClick={event => toggle(message.message_id, event.shiftKey)} title={`${message.user.name} · ${preview(message)}`}>
          <span className="history-check" aria-hidden="true">{selected.has(message.message_id) ? symbol('check') : message.retained ? symbol('keep') : symbol(historyTypeOptions.find(option => option.types.split(',').includes(String(message.type)))?.icon || 'chat_bubble')}</span><span className="history-record-content"><CompactMessageContent name={message.user.name} preview={preview(message)} /></span><time dateTime={new Date(message.created_at * 1000).toISOString()}>{new Intl.DateTimeFormat(localeForLanguage(language), {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'}).format(message.created_at * 1000)}</time>
        </button>)}</div>
      </section>)}
      {page?.has_more ? <button className="history-load-more" type="button" data-no-drag disabled={moreLoading || busy} onClick={() => void loadMore()}>{moreLoading ? t('common.loading') : t('historyManager.loadMore')}</button> : null}
    </div>
    <footer className={`history-selection-bar${selected.size ? ' has-selection' : ''}`}><span aria-live="polite">{selected.size ? t('historyManager.selected', {count:selected.size}) : t('historyManager.dragHint')}</span><div><button type="button" disabled={busy} aria-pressed={dragMode} onClick={() => setDragMode(value => !value)}>{symbol('select_all')}{t('historyManager.dragMode')}</button><button disabled={busy || !rows.length} type="button" onClick={() => setSelection(selected.size ? new Set() : new Set(rows.map(row => row.message_id)))}>{selected.size ? t('historyManager.clearSelection') : t('historyManager.selectLoaded')}</button>{selected.size ? <><button type="button" disabled={busy} onClick={() => void protect(false)}>{symbol('keep')}{t('historyManager.retain')}</button>{rows.some(row => selected.has(row.message_id) && row.retained) ? <button type="button" disabled={busy} onClick={() => void protect(true)}>{t('historyManager.release')}</button> : null}<button className="history-delete" type="button" disabled={busy} onClick={() => void previewDelete([...selected])}>{symbol('delete')}{t('historyManager.delete')}</button></> : null}</div></footer>
    {rectangle ? <div className="history-drag-rectangle" style={{left:rectangle.left,top:rectangle.top,width:rectangle.right-rectangle.left,height:rectangle.bottom-rectangle.top}}/> : null}
    <ConfirmDialog open={Boolean(plan)} title={t('historyManager.confirmTitle')} description={t('historyManager.confirmHint', {count:plan?.count ?? 0,retained:plan?.retained ?? 0})} confirmLabel={t('historyManager.delete')} busy={busy} danger onClose={() => { if (!busy) setPlan(null); }} onConfirm={() => void executeDelete()}>{busy ? <p role="status">{t('historyManager.progress', {count:deleted})}<button type="button" onClick={() => { stop.current = true; }}>{t('historyManager.stop')}</button></p> : null}</ConfirmDialog>
  </main>;
}
