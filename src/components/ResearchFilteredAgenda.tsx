import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { agendaDay, agendaEventsOn, agendaTimeRange } from '../lib/chronelleAgenda';
import type { CalendarRange } from '../lib/chronelleBridge';
import { profileAgenda, type ChronelleProfileDTO } from '../lib/chronelleProfile';
import { useI18n } from '../lib/language';
import { CalendarAvailabilityBar } from './CalendarAvailabilityBar';
import { DatePickerField } from './DatePickerField';

export function ResearchFilteredAgenda({ projectId, members, onRange }: {
  projectId: number;
  members: number[];
  onRange: (range: CalendarRange) => void;
}) {
  const { t, language } = useI18n();
  const [day, setDay] = useState(() => agendaDay());
  const [result, setResult] = useState<{ key: string; agenda: ReturnType<typeof profileAgenda> | null }>();
  const [retry, setRetry] = useState(0);
  const membersKey = members.join(',');
  const requestKey = `${projectId}:${membersKey}:${day.getTime()}:${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    const memberIds = membersKey.split(',').map(Number);
    api.researchCalendarAction<ChronelleProfileDTO>(projectId, {
      action: 'agenda', members: memberIds, start: day.toISOString(), end: agendaDay(day, 1).toISOString(),
    }, controller.signal).then(profileAgenda).then(agenda => {
      if (!controller.signal.aborted) setResult({ key: requestKey, agenda });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key: requestKey, agenda: null });
    });
    return () => controller.abort();
  }, [projectId, membersKey, day, requestKey]);
  const current = result?.key === requestKey ? result : undefined;
  const localDate = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
  const agenda = current?.agenda;
  const events = agenda ? agendaEventsOn(agenda.events, day) : [];
  const openMeeting = () => {
    const start = new Date(day);
    start.setHours(9);
    const end = new Date(start.getTime() + 30 * 60000);
    onRange({ start: start.toISOString(), end: end.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, all_day: false });
  };
  return <div className="research-filtered-agenda">
    <div className="research-filtered-agenda-header">
      <button type="button" className="ghost-button" aria-label={t('chronelle.previousDay')} onClick={()=>setDay(value=>agendaDay(value,-1))}>‹</button>
      <DatePickerField label={t('chronelle.chooseDay')} value={localDate} required onChange={value=>setDay(new Date(`${value}T00:00:00`))} />
      <button type="button" className="ghost-button" aria-label={t('chronelle.nextDay')} onClick={()=>setDay(value=>agendaDay(value,1))}>›</button>
    </div>
    {!current ? <p role="status">{t('chronelle.loading')}</p> : !agenda ? <div><p role="alert">{t('chronelle.loadFailed')}</p><button type="button" className="ghost-button" onClick={()=>setRetry(value=>value+1)}>{t('common.retry')}</button></div> : <>
      {agenda.known ? <CalendarAvailabilityBar day={day} events={agenda.events} /> : <p>{t('chronelle.limitedVisibility')}</p>}
      {events.length ? <ol>{events.map(event=><li key={event.id}>
        <time>{event.all_day ? t('chronelle.allDay') : agendaTimeRange(event, day, language)}</time>
        <div><strong>{event.locked ? t('chronelle.busy') : event.title || t('chronelle.untitled')}</strong>
          {event.location ? <small>{event.location}</small> : null}
          {event.description ? <small className="chronelle-event-notes">{event.description}</small> : null}
        </div>
      </li>)}</ol> : agenda.known ? <p>{t('chronelle.noEvents')}</p> : null}
      <button type="button" className="ghost-button research-filtered-meeting" onClick={openMeeting}>{t('research.calendarUI.meeting')}</button>
    </>}
  </div>;
}
