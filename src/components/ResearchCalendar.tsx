import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useI18n, type TranslationKey } from '../lib/language';
import type { ResearchProject } from '../lib/research';
import type { CalendarDisplays, CalendarSetup, ResearchMeeting } from '../lib/researchCalendar';
import type { CalendarRange } from '../lib/chronelleBridge';
import { meetingRangeFromFields, meetingTimeFields, newMeetingRange } from '../lib/researchMeetingTime';
import { showToast } from '../lib/toast';
import { CalendarFrame } from './ChronelleFrame';
import { ResearchFilteredAgenda } from './ResearchFilteredAgenda';
import { ChronellePluginDialog } from './ChronellePluginDialog';
import { SideDrawer } from './SideDrawer';
import { SettingRow, SettingSwitch } from './SettingRow';
import { DatePickerField } from './DatePickerField';
import { ChronellePermissionsDrawer } from './ChronellePermissionsDrawer';
import { QuietState } from './BoundaryState';
import { MarkdownInput } from './ResearchMarkdownInput';
import { PageTabs } from './PageTabs';
import { UserAvatar } from './UserAvatar';
import { MemberPickerSheet } from './MemberPickerSheet';
import { ResearchChronelleAgenda, ChronelleLoad, type InvitationSelection } from './ResearchChronelleAgenda';
import { ResearchChronelleInbox, ResearchChronelleInvitation } from './ResearchChronelleInbox';
import { ResearchChronelleManage, type CalendarDefaults, type CalendarPreferences, type CalendarSync } from './ResearchChronelleManage';
import { CalendarDestination, CalendarRepeat, type Destination } from './ResearchChronelleFields';
import { calendarTimezone, useChronelleCopy, useChronelleQuery, type ChronelleGroup } from '../lib/researchChronelle';
import type { Recurrence } from '../lib/chronelleRecurrence';
import './ResearchCalendar.css';
import './ResearchChronelle.css';

export function ResearchCalendar({ project, userId, onboarding=false, onOnboarded }: { project: ResearchProject; userId: number; onboarding?:boolean;onOnboarded?:()=>void }) {
  const { t, language } = useI18n();
  const {copy}=useChronelleCopy();
  const tr = (key: string) => t(('research.calendarUI.' + key) as TranslationKey);
  const [setup, setSetup] = useState<CalendarSetup | null>(null);
  const [selected, setSelected] = useState<number[]>([userId]);
  const [displays, setDisplays] = useState<CalendarDisplays | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [teamLoading,setTeamLoading]=useState(false);
  const [teamError,setTeamError]=useState('');
  const [tick, setTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [prefilledInvitees, setPrefilledInvitees] = useState<number[]>([]);
  const [meetings,setMeetings]=useState<ResearchMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [meetingError, setMeetingError] = useState('');
  const [resume,setResume]=useState<ResearchMeeting|null>(null);
  const [view,setView]=useState('agenda');
  const [invitation,setInvitation]=useState<InvitationSelection>();
  const [calendarTools,setCalendarTools]=useState(false);
  const [personalRevision,setPersonalRevision]=useState(0);
  const [memberPicker,setMemberPicker]=useState(false);
  const generation = useRef(0);
  useEffect(()=>{const reload=()=>setTick(n=>n+1);window.addEventListener('chronelle:bound',reload);return()=>window.removeEventListener('chronelle:bound',reload);},[]);
  useEffect(()=>{const reload=()=>{setTick(n=>n+1);if(onboarding)onOnboarded?.();};window.addEventListener('chronelle:permissions-saved',reload);return()=>window.removeEventListener('chronelle:permissions-saved',reload);},[onboarding,onOnboarded]);
  const errorText = (code: string) => {
    const key = 'research.calendarUI.error.' + code;
    const message = t(key as TranslationKey);
    return message === key ? tr('unavailable') : message;
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setDisplays(null);
    api.researchCalendar(project.id, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setSetup(value);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project.id, tick, userId]);

  const selectionKey = selected.join(',');
  useEffect(()=>{
    const controller=new AbortController();
    setLoadingMeetings(true);
    setMeetingError('');
    api.researchMeetings(project.id,controller.signal).then(rows => {
      if (!controller.signal.aborted) setMeetings(rows);
    }).catch(e => {
      if (!controller.signal.aborted) setMeetingError(errorText(e.message));
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingMeetings(false);
    });
    return()=>controller.abort();
  },[project.id,tick]);
  useEffect(() => {
    setDisplays(null);
    if (setup?.status !== 'active' || view !== 'schedule') return;
    if (!selected.length) { setTeamLoading(false); setTeamError(''); return; }
    const controller = new AbortController();
    const request = ++generation.current;
    setTeamLoading(true); setTeamError('');
    api.researchCalendarAction<CalendarDisplays>(project.id, { action: 'display', members: selected }, controller.signal)
      .then(value => { if (!controller.signal.aborted && request === generation.current) setDisplays(value); })
      .catch(e => { if (!controller.signal.aborted) setTeamError(errorText(e.message)); })
      .finally(() => { if (!controller.signal.aborted) setTeamLoading(false); });
    return () => controller.abort();
  }, [setup, selectionKey, project.id,view]);

  useEffect(() => {
    if (!displays?.renew_after || range) return;
    const timer = window.setTimeout(() => setTick(n => n + 1), displays.renew_after * 1000);
    return () => window.clearTimeout(timer);
  }, [displays,range]);

  const active = setup?.status === 'active';
  const writable = project.status === 'active';
  const groupsResult=useChronelleQuery<ChronelleGroup[]>(project.id,active?'groups':null,undefined,personalRevision+tick);
  const preferences=useChronelleQuery<CalendarPreferences>(project.id,active&&view==='agenda'?'calendar':null,undefined,personalRevision+tick);
  const defaults=useChronelleQuery<CalendarDefaults>(project.id,active&&view==='agenda'?'reminder-preferences':null,undefined,personalRevision+tick);
  const sync=useChronelleQuery<CalendarSync>(project.id,active&&view==='agenda'?'sync':null,undefined,personalRevision+tick);
  const groups=groupsResult.value??[];
  const reloadPersonal=()=>setPersonalRevision(n=>n+1);
  const newTeamMeeting=()=>openMeeting(newMeetingRange(),[]);
  const openMeeting = (value: CalendarRange, peers: number[]) => {
    if (!writable) return;
    setResume(null);
    setPrefilledInvitees(peers.filter(id => id !== userId));
    setRange(value);
  };
  const resetRange = (value: CalendarRange) => openMeeting(value, selected);
  function meetingTime(item: ResearchMeeting) {
    const timeZone = item.timezone;
    const start = new Date(item.start);
    const end = new Date(item.end);
    if (item.all_day) {
      const dateOnly = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone });
      const first = dateOnly.format(start);
      const last = dateOnly.format(new Date(end.getTime() - 1));
      return first === last ? first : first + ' – ' + last;
    }
    const dateTime = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone });
    const { from, to } = meetingTimeFields(item);
    const endFormat = from === to ? new Intl.DateTimeFormat(language, { timeStyle: 'short', timeZone }) : dateTime;
    return dateTime.format(start) + ' – ' + endFormat.format(end);
  }
  const now = Date.now();
  const visibleMeetings = [...meetings].sort((first, second) => {
    const a = Date.parse(first.start), b = Date.parse(second.start);
    return Number(a < now) - Number(b < now) || (a < now ? b - a : a - b);
  });
  const ongoingMeetings=visibleMeetings.filter(item=>Date.parse(item.end)>=now||item.status==='failed'||item.status==='unknown'||item.status==='pending');
  const pastMeetings=visibleMeetings.filter(item=>!ongoingMeetings.includes(item));
  const renderMeeting=(item:ResearchMeeting)=><article key={item.id}>
    <div><strong>{item.title}</strong>
      <p>{meetingTime(item)}{item.all_day ? ` · ${tr('allDay')}` : ''}</p>
      {item.members.length>1&&<p>{project.members.filter(member=>member.id!==item.creator_id&&item.members.includes(member.id)).map(member=>member.name).join(' · ')}</p>}
      <small>{tr('meetingStatus.'+item.status)}</small>
    </div>
    {item.invitation_id&&item.members.includes(userId)?<button type="button" className="ghost-button"
      onClick={()=>setInvitation({id:item.invitation_id!})}>{copy('preview')}</button>
      :writable&&item.creator_id===userId&&!item.invitation_id&&<button className="ghost-button" onClick={()=>{
        setResume(item);
        setRange({start:item.start,end:item.end,timezone:item.timezone,all_day:item.all_day});
      }}>{tr(item.status==='failed'?'editInvitation':'retryMeeting')}</button>}
  </article>;
  return <section className="research-calendar">
    <header className="research-calendar-controls">
      <PageTabs label={t('research.calendar')} value={view} onChange={setView}
        items={[{value:'agenda',label:copy('agenda')},{value:'schedule',label:copy('teamCalendar')},{value:'inbox',label:copy('inbox')},{value:'meetings',label:tr('meetings')}]} />
      <div className="research-calendar-tools">
        {active && view === 'schedule' && <button className="ghost-button" onClick={() => setSettingsOpen(true)} aria-label={tr('visibility')}>
          <span className="material-symbols-outlined" aria-hidden="true">tune</span><span>{tr('visibility')}</span>
        </button>}
        {active&&view==='agenda'&&<button type="button" className="ghost-button" onClick={()=>setCalendarTools(true)}>
          <span className="material-symbols-outlined" aria-hidden="true">settings</span>{copy('more')}
        </button>}
        {active && writable && (view==='schedule'||view==='meetings') && <button type="button" className="button research-meeting-create"
          onClick={newTeamMeeting}>
          <span className="material-symbols-outlined" aria-hidden="true">add</span>{copy('newMeeting')}
        </button>}
      </div>
    </header>
    {(view==='agenda'||view==='inbox')&&<ChronelleLoad loading={loading||groupsResult.loading} error={error||groupsResult.error} onRetry={()=>setTick(n=>n+1)}>
      {!active?<QuietState icon="calendar_month" title={setup?.status==='binding_required'?t('research.connectCalendar'):errorText(setup?.status||'chronelle_unavailable')}
        description={setup?.status==='binding_required'?t('researchWorkbench.calendarConnection'):undefined}
        action={setup?.status!=='integration_not_configured'?<button type="button" className="button" onClick={()=>setConsent(true)}>{tr('bind')}</button>:undefined}/>
      :view==='agenda'?<ResearchChronelleAgenda project={project.id} groups={groups} writable={writable} revision={personalRevision}
        zone={calendarTimezone(defaults.value?.timezone)} weekStart={preferences.value?.week_start} sync={sync.value} reload={reloadPersonal} openInvitation={setInvitation}/>
      :<ResearchChronelleInbox project={project.id} groups={groups} writable={writable} revision={personalRevision}
        onChanged={reloadPersonal} onOpen={setInvitation} openTeamInvitation={newTeamMeeting}/>}
    </ChronelleLoad>}
    {view === 'schedule' && <>{active && <div className="research-calendar-members" role="group" aria-label={tr('members')}>
      <button type="button" className="ghost-button" onClick={() => setMemberPicker(true)}>
        <span className="material-symbols-outlined" aria-hidden="true">group_add</span>{tr('members')}
      </button>
      {project.members.filter(member => selected.includes(member.id)).slice(0, 4).map(member => <label key={member.id}>
        <input type="checkbox" checked={selected.includes(member.id)} disabled={loading || teamLoading}
          onChange={e => setSelected(ids => e.target.checked ? [...ids, member.id] : ids.filter(id => id !== member.id))} />
        <UserAvatar className="research-calendar-avatar" name={member.name} uri={member.avatar_uri} cacheKey={member.avatar_cache_key} frame={member.avatar_frame_style}/>
        {member.id === userId ? tr('self') : member.name}
      </label>)}
      {selected.length > 4 && <span className="research-workbench-count">+{selected.length - 4}</span>}
    </div>}
    {loading || (active&&teamLoading) ? <p className="research-muted" role="status">{t('common.loading')}</p>
    : error || teamError ? <QuietState icon="calendar_month" title={tr('unavailable')} description={error||teamError}
      action={<button className="ghost-button" onClick={() => setTick(n => n + 1)}>{t('common.retry')}</button>} />
    : !active ? <QuietState icon="calendar_month" title={setup?.status === 'binding_required' ? t('research.connectCalendar') : errorText(setup?.status || 'chronelle_unavailable')}
      description={setup?.status === 'binding_required' ? t('researchWorkbench.calendarConnection') : undefined}
      action={setup?.status !== 'integration_not_configured' ? <button className="button" onClick={() => setConsent(true)}>{tr('bind')}</button> : undefined} />
    : !selected.length ? <QuietState icon="event_available" title={tr('choose')} /> : displays?.filtered ? <ResearchFilteredAgenda projectId={project.id} members={selected}
      onRange={resetRange} /> : displays?.displays.length ? <CalendarFrame
      url={displays.displays[0].url} tokens={displays.displays.map(d => d.token)} date={new Date().toLocaleDateString('en-CA')}
      onRange={resetRange} onRenew={() => setTick(n => n + 1)} /> : <QuietState icon="event_available" title={t('researchWorkbench.noCalendarDisplay')} />}
    </>}
    {view === 'meetings' && loadingMeetings && <p className="research-muted" role="status">{t('common.loading')}</p>}
    {view === 'meetings' && meetingError && <QuietState icon="event_busy" title={tr('unavailable')} description={meetingError}
      action={<button className="ghost-button" onClick={() => setTick(n => n + 1)}>{t('common.retry')}</button>} />}
    {view === 'meetings' && !loadingMeetings && !meetingError && <section className="research-meetings">
      {ongoingMeetings.length ? ongoingMeetings.map(renderMeeting) : <QuietState icon="event_available" title={tr('noMeetings')} description={writable ? tr('meetingHint') : undefined}
        action={<button className="ghost-button" onClick={() => setView('schedule')}>{tr('schedule')}</button>} />}
      {pastMeetings.length>0&&<details className="research-meetings-history"><summary>{copy('pastMeetings')} <small>{pastMeetings.length}</small></summary>{pastMeetings.map(renderMeeting)}</details>}
    </section>}

    {memberPicker&&<MemberPickerSheet title={tr('members')} initial={selected} members={project.members.map(member=>({...member,description:member.id===userId?tr('self'):undefined}))} limit={20} onClose={()=>setMemberPicker(false)} onApply={setSelected}/>}
    <ChronellePermissionsDrawer open={settingsOpen} onClose={()=>setSettingsOpen(false)} onRebind={()=>{setSettingsOpen(false);setConsent(true);}}/>
    <ChronellePluginDialog open={consent} onClose={()=>setConsent(false)} userId={userId}
      context={{entry:"research",project:project.id,onboarding}} onChange={()=>setTick(n=>n+1)}/>
    {invitation&&<ResearchChronelleInvitation key={invitation.id+invitation.occurrence} project={project.id} selection={invitation}
      groups={groups} writable={writable} onClose={()=>setInvitation(undefined)}
      onChanged={()=>{setInvitation(undefined);reloadPersonal();}}/>}
    {calendarTools&&<ResearchChronelleManage project={project.id} writable={writable} groups={groups} revision={personalRevision}
      onClose={()=>setCalendarTools(false)} onChanged={reloadPersonal}/>}
    <SideDrawer showTitle className="research-workflow-drawer research-meeting-drawer" historyKey="research-meeting-create"
      open={!!range} onClose={() => setRange(null)} title={tr(resume ? 'editInvitation' : 'newEvent')}>
      {range && <MeetingForm key={resume?.id || range.start} range={range} project={project} userId={userId}
        initialInvitees={prefilledInvitees} groups={groups} eligible={setup?.invitable_member_ids}
        resume={resume} errorText={errorText} onDone={() => {
          setRange(null);
          showToast(tr('invitationSent'));
          setView('meetings');
          setTick(n => n + 1);
          reloadPersonal();
        }} onAttempt={() => {
          void api.researchMeetings(project.id).then(setMeetings).catch(() => {});
        }} />}
    </SideDrawer>
  </section>;
}

function MeetingForm({
  range, project, userId, initialInvitees, groups, eligible, resume, errorText, onDone, onAttempt,
}: {
  range: CalendarRange; project: ResearchProject; userId: number; initialInvitees: number[];
  groups: ChronelleGroup[]; eligible?: number[]; resume: ResearchMeeting | null;
  errorText: (code: string) => string; onDone: () => void; onAttempt: () => void;
}) {
  const { t } = useI18n();
  const tr = (key: string) => t(('research.calendarUI.' + key) as TranslationKey);
  const [command, setCommand] = useState(() => crypto.randomUUID());
  const [fields, setFields] = useState(() => {
    const initial = meetingTimeFields(range);
    return range.all_day ? { ...initial, startTime: '09:00', endTime: '09:30' } : initial;
  });
  const [allDay, setAllDay] = useState(range.all_day);
  const [description, setDescription] = useState(resume?.description ?? '');
  const [destination, setDestination] = useState<Destination>({group_id:resume?.group_id??groups[0]?.id??null,category_id:resume?.category_id??null});
  const [recurrence,setRecurrence]=useState<Recurrence|undefined>(resume?.recurrence);
  const group=destination.group_id??groups[0]?.id;
  const [invitees, setInvitees] = useState(() => (resume?.members ?? initialInvitees).filter(id => id !== userId));
  const [picking, setPicking] = useState(false);
  const [attempt, setAttempt] = useState<Record<string, unknown> | null>(() =>
    resume && resume.status !== 'failed' ? { ...resume, command_id: resume.id } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = new Set(invitees);
  const ready = eligible && new Set(eligible);
  const candidates = project.members.filter(member => member.id !== userId);
  const people = candidates.filter(member => selected.has(member.id));
  const cannotSend = people.some(member => ready && !ready.has(member.id));
  const locked = busy || Boolean(attempt);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (!attempt && (!group || !people.length || cannotSend))) return;
    let body = attempt;
    if (!body) {
      const form = new FormData(event.currentTarget);
      const title = String(form.get('title') ?? '').trim();
      if (!title) {
        setError(tr('titleRequired'));
        return;
      }
      try {
        body = {
          ...meetingRangeFromFields(fields, range.timezone, allDay),
          command_id: command,
          title,
          location: String(form.get('location') ?? ''),
          description, group_id: Number(group), members: [userId, ...people.map(member => member.id)],
          ...(destination.category_id?{category_id:destination.category_id}:{}),...(recurrence?{recurrence}:{}),
        };
      } catch {
        setError(tr('invalidTime'));
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      await api.researchBookMeeting(project.id, body);
      onDone();
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.message : 'meeting_result_unknown';
      setError(errorText(code));
      if (attempt || !(cause instanceof ApiError) || cause.status >= 500 || code === 'meeting_processing') {
        setAttempt(body);
      } else {
        setCommand(crypto.randomUUID());
      }
      onAttempt();
    } finally {
      setBusy(false);
    }
  }

  return <form className="research-form research-meeting-form" onSubmit={submit}>
    <fieldset disabled={locked}>
      <label>{tr('meetingTitle')}<input name="title" required maxLength={160} placeholder={tr('titleExample')} defaultValue={resume?.title} /></label>
      <section className="research-meeting-invitees">
        <div className="research-meeting-section-heading">
          <strong>{tr('invitees')}{people.length ? ` · ${people.length}` : ''}</strong>
          <button className="ghost-button" type="button" onClick={() => setPicking(true)}>
            <span className="material-symbols-outlined" aria-hidden="true">person_add</span>
            {tr(people.length ? 'changeInvitees' : 'choosePeople')}
          </button>
        </div>
        {people.length ? <ul className="research-meeting-people">{people.map(member => <li key={member.id}>
          <UserAvatar className="research-calendar-avatar" name={member.name} uri={member.avatar_uri}
            cacheKey={member.avatar_cache_key} frame={member.avatar_frame_style} />
          <span>{member.name}</span>
          {!attempt && <button type="button" className="icon-button" aria-label={tr('removeInvitee') + ' ' + member.name}
            onClick={() => setInvitees(ids => ids.filter(id => id !== member.id))}>
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>}
        </li>)}</ul> : <p className="research-muted">{tr('chooseInvitees')}</p>}
        {cannotSend && !attempt && <p className="research-error" role="status">{tr('inviteeLinkRequired')}</p>}
      </section>

      <section className="research-meeting-time">
        <SettingRow title={tr('allDay')} description={range.timezone} trailing={<SettingSwitch label={tr('allDay')} checked={allDay}
          onChange={setAllDay} disabled={locked} />} />
        <div className="research-meeting-time-grid">
          <div>
            <DatePickerField label={t('research.start')} value={fields.from} required onChange={from =>
              setFields(previous => ({ ...previous, from, to: previous.to === previous.from || previous.to < from ? from : previous.to }))} />
            {!allDay && <input type="time" required aria-label={tr('startTime')} value={fields.startTime}
              onChange={event => setFields(previous => ({ ...previous, startTime: event.target.value }))} />}
          </div>
          <div>
            <DatePickerField label={t('research.end')} value={fields.to} min={fields.from} required
              onChange={to => setFields(previous => ({ ...previous, to }))} />
            {!allDay && <input type="time" required aria-label={tr('endTime')} value={fields.endTime}
              onChange={event => setFields(previous => ({ ...previous, endTime: event.target.value }))} />}
          </div>
        </div>
      </section>

      <details className="research-form-options" open={Boolean(resume?.location || resume?.description) || undefined}>
        <summary>{tr('meetingOptions')}</summary>
        <label>{tr('location')}<input name="location" maxLength={1000} defaultValue={resume?.location} /></label>
        <MarkdownInput value={description} onChange={setDescription} rows={4} mobileImmersive={false} workspace />
      </details>
      <CalendarDestination groups={groups} value={{...destination,group_id:group??null}} onChange={setDestination}/>
      {!locked&&<CalendarRepeat start={fields.from||range.start.slice(0,10)} allDay zone={range.timezone} rule="" value={recurrence} onChange={setRecurrence}/>}
    </fieldset>
    <footer className="research-task-editor-footer research-meeting-submit">
      {error && <p className="research-form-error" role="alert">{error}</p>}
      <p className="research-muted">{tr(attempt ? 'sameRequest' : !groups.length ? 'noDestination' : 'inviteConfirmation')}</p>
      <button className="button" disabled={busy || (!attempt && (!group || !people.length || cannotSend))}>
        {tr(busy ? 'sending' : attempt ? 'retryMeeting' : 'sendInvitations')}{!attempt && people.length > 0 ? ` · ${people.length}` : ''}
      </button>
    </footer>
    {picking && <MemberPickerSheet title={tr('choosePeople')} initial={invitees.filter(id => !ready || ready.has(id))}
      members={candidates.map(member => ({
        ...member,
        locked: ready ? !ready.has(member.id) : false,
        lockedLabel: tr('notLinked'),
      }))} limit={19} onClose={() => setPicking(false)} onApply={setInvitees} />}
  </form>;
}
