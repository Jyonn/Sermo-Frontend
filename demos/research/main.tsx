import React, { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/lib/auth';
import { LanguageProvider } from '../../src/lib/language';
import { ThemeProvider, useTheme } from '../../src/lib/theme';
import { activateLanguage } from '../../src/lib/i18n';
import { SideDrawer } from '../../src/components/SideDrawer';
import { BottomSheet } from '../../src/components/BottomSheet';
import { DrawerTabs } from '../../src/components/DrawerTabs';
import { copy, type CopyKey } from './copy';
import { seed, friends, mentor, visibleEntries, canWrite, type Project, type Task, type Meeting, type TaskStatus, type Entry } from './model';
import '../../styles.css';
import './style.css';

const STORE = 'frienden:research-demo:v2';
const params = new URLSearchParams(location.search);
const locale = params.get('lang') === 'en' ? 'en' : 'zh';
const t = (key: CopyKey) => copy[locale][key];
const date = (value: string) => new Date(value.length === 10 ? `${value}T12:00` : value).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { month: 'short', day: 'numeric' });
const Icon = ({ name }: { name: string }) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
const Avatar = ({ name }: { name: string }) => <span className="r-avatar" aria-hidden="true">{name.slice(0, 1)}</span>;
function load(): Project[] { try { const saved = JSON.parse(localStorage.getItem(STORE) || 'null'); if (Array.isArray(saved) && saved.length && saved.every(p => p.members && p.tasks && p.meetings)) return saved; } catch {} return structuredClone(seed); }
type Panel = null | 'task' | 'meeting' | 'project' | 'settings' | 'invite' | 'chat';
type Tab = 'tasks' | 'meetings' | 'records' | 'members';
function App() {
  const { resolvedTheme, setPreference } = useTheme();
  const [projects, setProjects] = useState(load);
  const [projectId, setProjectId] = useState(1);
  const [tab, setTab] = useState<Tab>('tasks');
  const [role, setRole] = useState<'mentor' | 'student'>('mentor');
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [selected, setSelected] = useState<number | null>(() => window.innerWidth > 950 ? 11 : null);
  const [chooser, setChooser] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [meetingId, setMeetingId] = useState<number | null>(null);
  const [entryKind, setEntryKind] = useState<Entry['kind'] | null>(null);
  const [toast, setToast] = useState('');
  const [attached, setAttached] = useState(false);
  const project = projects.find(p => p.id === projectId) || projects[0];
  const isMentor = role === 'mentor';
  const viewer = isMentor ? mentor : project.members.find(member => member.role === 'student') || friends[0];
  const writable = canWrite(project);
  const task = project.tasks.find(item => item.id === selected);
  const meeting = project.meetings.find(item => item.id === meetingId);
  const tasks = project.tasks.filter(item => (isMentor || item.assignees.includes(viewer.id)) && (filter === 'all' || item.status === filter));
  const records = project.tasks.flatMap(item => visibleEntries(item, viewer.id, isMentor).map(entry => ({ ...entry, task: item })));
  const tell = (value: string) => setToast(value);
  const update = (change: (p: Project) => Project) => setProjects(previous => previous.map(p => p.id === project.id ? change(p) : p));
  const updateTask = (change: (value: Task) => Task) => update(p => ({ ...p, tasks: p.tasks.map(item => item.id === task?.id ? change(item) : item) }));
  const close = () => { setPanel(null); setMeetingId(null); setEntryKind(null); setAttached(false); };
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(projects)); } catch { tell(t('demoOnly')); } }, [projects]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (params.has('dark')) setPreference('dark'); else if (params.has('light')) setPreference('light'); }, []);
  function switchProject(id: number) { setProjectId(id); setSelected(null); setFilter('all'); setChooser(false); setTab('tasks'); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) || '').trim();
    const ids = data.getAll('member').map(Number);
    if (panel === 'project') {
      const id = Date.now();
      setProjects(previous => [...previous, { id, title: value('title'), status: 'planning', description: value('description'), members: [mentor], tasks: [], meetings: [] }]);
      setProjectId(id); setSelected(null); setTab('tasks'); setRole('mentor');
    } else if (panel === 'settings' && isMentor) {
      update(p => ({ ...p, title: value('title'), description: value('description'), status: value('status') as Project['status'] }));
    } else if (panel === 'task' && isMentor && writable) {
      if (!ids.length) return tell(t('emptySelection'));
      const id = Date.now();
      update(p => ({ ...p, tasks: [{ id, title: value('title'), description: value('description'), assignees: ids, deadline: value('deadline'), status: 'todo', entries: [] }, ...p.tasks] }));
      setSelected(id); setTab('tasks'); setFilter('all');
    } else if (panel === 'meeting' && !meeting && isMentor && writable) {
      update(p => ({ ...p, meetings: [...p.meetings, { id: Date.now(), title: value('title'), date: value('date'), place: value('place'), agenda: value('agenda'), minutes: '' }] }));
      setTab('meetings');
    } else if (panel === 'meeting' && meeting && writable) {
      update(p => ({ ...p, meetings: p.meetings.map(item => item.id === meeting.id ? { ...item, minutes: value('minutes') } : item) }));
    } else if (panel === 'invite' && isMentor && writable) {
      if (!ids.length) return tell(t('emptySelection'));
      update(p => ({ ...p, members: [...p.members, ...friends.filter(friend => ids.includes(friend.id) && !p.members.some(m => m.id === friend.id))] }));
    } else if (entryKind && task && writable && (isMentor || task.assignees.includes(viewer.id))) {
      const entry: Entry = { id: Date.now(), owner: viewer.id, recipient: entryKind === 'feedback' ? Number(data.get('recipient')) : undefined, kind: entryKind, body: value('body'), date: new Date().toLocaleString('sv-SE').slice(0, 16) };
      updateTask(item => ({ ...item, status: entryKind === 'summary' ? 'review' : item.status, entries: [...item.entries, entry] }));
    }
    close(); tell(t('saved'));
  }
  const label = entryKind ? t(entryKind) : panel === 'task' ? t('createTask') : panel === 'project' ? t('createProject') : panel === 'settings' ? t('projectSettings') : panel === 'invite' ? t('invite') : panel === 'meeting' ? t(meeting ? 'viewMeeting' : 'createMeeting') : t('chatPreview');
  const panelOpen = Boolean(panel || entryKind);
  const canRecord = task && writable && task.assignees.includes(viewer.id);
  function entryCard(entry: Entry) { return <article className={`r-entry ${entry.kind === 'feedback' ? 'is-feedback' : ''}`} key={entry.id}>
    <div className="r-entry-meta"><Avatar name={project.members.find(m => m.id === entry.owner)?.name || mentor.name}/><strong>{project.members.find(m => m.id === entry.owner)?.name || mentor.name}</strong><span>{t(entry.kind)}</span><time>{entry.date}</time></div><p>{entry.body}</p>
  </article>; }
  return <div className="research-demo">
    <aside className="r-nav"><a href="./index.html" className="r-brand"><img src="/icons/frienden-app-192-v3.png" alt="Frienden"/><span>Frienden<small>友间</small></span></a><nav aria-label="Frienden">{([['chats','chat'],['square','explore'],['submissions','outbox'],['contacts','forum'],['research','science'],['menu','menu']] as const).map(([key, icon]) => <button key={key} aria-label={t(key)} className={key === 'research' ? 'active' : ''} aria-current={key === 'research' ? 'page' : undefined} onClick={() => key === 'research' ? (setTab('tasks'), setSelected(null)) : tell(t('demoNav'))}><Icon name={icon}/><span>{t(key)}</span></button>)}</nav><div className="r-nav-bottom"><Avatar name={viewer.name}/><span>{viewer.name}<small>{t(role)}</small></span></div></aside>
    <main className="r-workspace">
      <header className="r-header"><button className="r-project-button" onClick={() => setChooser(true)} aria-label={t('projects')}><span className="r-project-mark"><Icon name="science"/></span><span><small>{t('research')}<i className={`r-dot ${project.status}`}/>{t(project.status)}</small><strong>{project.title}</strong></span><Icon name="unfold_more"/></button><div className="r-header-actions"><button className="r-icon" title={t('switchRole')} aria-label={t('switchRole')} onClick={() => { setRole(isMentor ? 'student' : 'mentor'); setSelected(null); }}><Icon name="switch_account"/><span>{t(role)}</span></button><button className="r-icon" title={t('theme')} aria-label={t('theme')} onClick={() => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')}><Icon name={resolvedTheme === 'dark' ? 'light_mode' : 'dark_mode'}/></button><button className="r-icon" aria-label={t('projectSettings')} onClick={() => setPanel('settings')}><Icon name="more_horiz"/></button></div></header>
      <div className="r-preview-label"><span>{t('prototype')}</span><span>{t('roleHint')} · {viewer.name}</span></div>
      <div className="r-topline"><DrawerTabs label={t('research')} items={(['tasks','meetings','records','members'] as Tab[]).map(value => ({ value, label: t(value) }))} value={tab} onChange={value => { setTab(value); setSelected(null); }}/><button className="r-discuss" aria-label={t('discussion')} onClick={() => setPanel('chat')}><Icon name="chat_bubble"/><span>{t('discussion')}</span></button></div>
      <div className={`r-content ${tab === 'tasks' ? 'is-task-view' : ''} ${task ? 'has-detail' : ''}`}>
        {tab === 'tasks' ? <>
          <section className="r-task-list" aria-label={t('taskList')}>
            <div className="r-section-heading"><div><small>{t('activeTasks')}</small><h1>{t('milestone')}</h1></div>{isMentor && writable && <button className="r-icon r-new" aria-label={t('createTask')} onClick={() => setPanel('task')}><Icon name="add"/></button>}</div>
            <div className="r-progress"><span><b>{project.tasks.filter(item => item.status === 'done').length}</b> / {project.tasks.length} {t('completedTasks')}</span><div><i style={{ width: `${project.tasks.length ? project.tasks.filter(item => item.status === 'done').length / project.tasks.length * 100 : 0}%` }}/></div></div>
            <div className="r-filters" aria-label={t('status')}>{(['all','doing','review','done'] as const).map(status => <button key={status} aria-pressed={filter === status} onClick={() => { setFilter(status); setSelected(null); }}>{t(status)}</button>)}</div>
            <div className="r-task-rows">{tasks.map(item => <button key={item.id} className={`r-task-row ${selected === item.id ? 'selected' : ''}`} onClick={() => setSelected(item.id)}><span className={`r-task-status ${item.status}`}><Icon name={item.status === 'done' ? 'check_circle' : item.status === 'review' ? 'rate_review' : 'radio_button_unchecked'}/></span><span className="r-task-row-body"><strong>{item.title}</strong><span>{item.assignees.map(id => project.members.find(m => m.id === id)?.name).join('、')}<i/> {date(item.deadline)}</span><small className={`r-status ${item.status}`}>{t(item.status)}</small></span><Icon name="chevron_right"/></button>)}{!tasks.length && <div className="r-empty"><Icon name="assignment"/><p>{t(project.tasks.length ? 'noResults' : 'noTasks')}</p>{isMentor && writable && <button className="button" onClick={() => setPanel('task')}>{t('createTask')}</button>}</div>}</div>
            {project.meetings[0] && <button className="r-next-meeting" onClick={() => { setMeetingId(project.meetings[0].id); setPanel('meeting'); }}><Icon name="event"/><span><small>{t('next')} · {date(project.meetings[0].date)}</small><strong>{project.meetings[0].title}</strong></span><Icon name="arrow_forward"/></button>}
            <p className="r-privacy"><Icon name="lock"/>{t('private')}</p>
          </section>
          <section className="r-task-detail" aria-label={t('detail')}>{task ? <>
            <header className="r-detail-header"><button className="r-icon r-back" aria-label={t('back')} onClick={() => setSelected(null)}><Icon name="arrow_back"/></button><span className={`r-status ${task.status}`}>{t(task.status)}</span><span className="r-spacer"/>{isMentor && writable ? <select aria-label={t('status')} value={task.status} onChange={event => updateTask(item => ({ ...item, status: event.target.value as TaskStatus }))}>{(['todo','doing','review','done'] as const).map(status => <option key={status} value={status}>{t(status)}</option>)}</select> : null}<button className="r-icon" aria-label={t('close')} onClick={() => setSelected(null)}><Icon name="close"/></button></header>
            <div className="r-detail-scroll"><h2>{task.title}</h2><div className="r-task-meta"><span><Icon name="group"/>{task.assignees.map(id => project.members.find(m => m.id === id)?.name).join('、')}</span><span><Icon name="event"/>{t('due')} {date(task.deadline)}</span></div><div className="r-brief"><h3>{t('detail')}</h3><p>{task.description}</p></div><div className="r-section-line"><h3>{t('report')}</h3><span><Icon name="lock"/>{t('privateRecord')}</span></div>{visibleEntries(task, viewer.id, isMentor).map(entryCard)}{!visibleEntries(task, viewer.id, isMentor).length && <p className="r-muted">{t('noRecords')}</p>}<button className="r-text-button" onClick={() => setPanel('chat')}><Icon name="forum"/>{t('taskDiscussion')}<Icon name="arrow_outward"/></button></div>
            {writable && <footer className="r-detail-footer">{isMentor ? <button className="button" onClick={() => setEntryKind('feedback')}>{t('feedback')}</button> : canRecord ? <><button className="button secondary" onClick={() => setEntryKind('summary')}>{t('writeSummary')}</button><button className="button" onClick={() => setEntryKind('progress')}>{t('writeProgress')}</button></> : <p>{t('readOnlyRecord')}</p>}</footer>}
          </> : <div className="r-idle"><div className="r-orbit"><Icon name="science"/></div><h2>{t('selectTask')}</h2><p>{project.description}</p><span>{project.members.length} {t('membersCount')} · {project.tasks.length} {t('taskCount')}</span></div>}</section>
        </> : <section className="r-page-section">
          <div className="r-section-heading"><div><small>{project.title}</small><h1>{t(tab === 'records' ? 'report' : tab)}</h1></div>{isMentor && writable && (tab === 'meetings' || tab === 'members') && <button className="button" onClick={() => setPanel(tab === 'meetings' ? 'meeting' : 'invite')}><Icon name="add"/>{t(tab === 'meetings' ? 'createMeeting' : 'invite')}</button>}</div>
          {tab === 'meetings' && <div className="r-meetings">{project.meetings.map(item => <button className="r-meeting-row" key={item.id} onClick={() => { setMeetingId(item.id); setPanel('meeting'); }}><span className="r-calendar-date"><small>{new Date(item.date).getMonth() + 1} /</small><strong>{new Date(item.date).getDate()}</strong></span><span><small>{item.date.slice(11)} · {item.place}</small><h2>{item.title}</h2><p>{item.agenda.split('\n')[0]}</p></span><Icon name="chevron_right"/></button>)}{!project.meetings.length && <div className="r-empty"><Icon name="event"/><p>{t('noMeetings')}</p></div>}</div>}
          {tab === 'records' && <><p className="r-privacy"><Icon name="lock"/>{t(isMentor ? 'private' : 'peerPrivacy')}</p>{records.map(entry => <div className="r-record" key={entry.id}><button className="r-text-button" onClick={() => { setTab('tasks'); setSelected(entry.task.id); }}>{entry.task.title}<Icon name="arrow_forward"/></button>{entryCard(entry)}</div>)}{!records.length && <div className="r-empty">{t('noRecords')}</div>}</>}
          {tab === 'members' && <><div className="r-member-list">{project.members.map(member => <div key={member.id} className="r-member-row"><Avatar name={member.name}/><span><strong>{member.name}</strong><small>{t(member.role === 'mentor' ? 'memberRole' : 'student')}</small></span><span className="r-muted">{project.tasks.filter(item => item.assignees.includes(member.id)).length} {t('taskCount')}</span></div>)}</div><p className="r-privacy"><Icon name="shield"/>{t('peerPrivacy')}</p></>}
        </section>}
      </div>
    </main>
    <BottomSheet open={chooser} title={t('projects')} onClose={() => setChooser(false)} className="r-sheet"><div className="r-project-list">{(['active','planning','completed'] as const).map(status => <section key={status}><h4>{t(status)}</h4>{projects.filter(p => p.status === status).map(p => <button className={p.id === project.id ? 'selected' : ''} key={p.id} onClick={() => switchProject(p.id)}><span className={`r-project-mark ${status}`}><Icon name={status === 'completed' ? 'inventory_2' : 'science'}/></span><span><strong>{p.title}</strong><small>{p.members.length} {t('membersCount')} · {p.tasks.length} {t('taskCount')}</small></span><Icon name={p.id === project.id ? 'check' : 'chevron_right'}/></button>)}</section>)}<button className="button secondary" onClick={() => { setChooser(false); setPanel('project'); }}><Icon name="add"/>{t('createProject')}</button></div></BottomSheet>
    <SideDrawer open={panelOpen} onClose={close} historyMode="route" title={label} className="r-editor" backdropClassName="r-editor-backdrop" headerAction={<button type="button" className="r-icon r-desktop-close" aria-label={t('close')} onClick={close}><Icon name="close"/></button>} trapFocus>
      {panel === 'chat' ? <div className="r-form"><div className="r-chat-preview"><Icon name="forum"/><h2>{project.title}</h2><p>{t('chatBody')}</p><div className="r-chat-message"><Avatar name={mentor.name}/><p>{project.meetings[0]?.agenda || project.description}</p></div><button className="button secondary" onClick={close}>{t('close')}</button></div><small>{t('demoOnly')}</small></div> : <form className="r-form" key={`${panel}-${entryKind}-${meetingId}`} onSubmit={submit}>
        {(panel === 'task' || panel === 'project' || panel === 'settings' || (panel === 'meeting' && !meeting)) && <label>{t(panel === 'project' || panel === 'settings' ? 'name' : 'title')}<input name="title" required maxLength={160} defaultValue={panel === 'settings' ? project.title : ''} readOnly={panel === 'settings' && !isMentor}/></label>}
        {(panel === 'task' || panel === 'project' || panel === 'settings') && <label>{t('description')}<textarea name="description" rows={5} defaultValue={panel === 'settings' ? project.description : ''} placeholder={t('newProjectDescription')} readOnly={panel === 'settings' && !isMentor}/></label>}
        {panel === 'settings' && <label>{t('status')}<select name="status" defaultValue={project.status} disabled={!isMentor}>{(['planning','active','completed'] as const).map(status => <option key={status} value={status}>{t(status)}</option>)}</select></label>}
        {panel === 'task' && <><label>{t('deadline')}<input name="deadline" type="date" defaultValue="2026-11-03" required/></label><fieldset><legend>{t('assignees')}</legend>{project.members.filter(m => m.role === 'student').map(member => <label className="r-check" key={member.id}><Avatar name={member.name}/><span>{member.name}</span><input type="checkbox" name="member" value={member.id}/></label>)}</fieldset></>}
        {panel === 'invite' && <><p className="r-muted">{t('inviteHelp')}</p>{friends.filter(friend => !project.members.some(m => m.id === friend.id)).map(friend => <label className="r-check" key={friend.id}><Avatar name={friend.name}/><span>{friend.name}</span><input type="checkbox" name="member" value={friend.id}/></label>)}{friends.every(friend => project.members.some(m => m.id === friend.id)) && <p>{t('noFriends')}</p>}</>}
        {panel === 'meeting' && !meeting && <><label>{t('date')}<input type="datetime-local" name="date" defaultValue="2026-10-30T14:00" required/></label><label>{t('place')}<input name="place" required/></label><label>{t('agenda')}<textarea name="agenda" rows={5} required/></label></>}
        {panel === 'meeting' && meeting && <><h2>{meeting.title}</h2><p className="r-muted">{meeting.date.replace('T', ' ')}<br/>{meeting.place}</p><h3>{t('agenda')}</h3><p className="r-prewrap">{meeting.agenda}</p><label>{t('minutes')}<textarea name="minutes" rows={8} defaultValue={meeting.minutes} placeholder={t('blankMinutes')} readOnly={!writable}/></label></>}
        {entryKind && <><p className="r-muted">{task?.title}</p><label>{t('entryBody')}<textarea name="body" rows={10} required maxLength={20000} placeholder={t('contentPlaceholder')}/></label><button type="button" className="r-text-button" onClick={() => { setAttached(true); tell(t('fileAdded')); }}><Icon name="attach_file"/>{t(attached ? 'attachment' : 'addAttachment')}</button><p className="r-privacy"><Icon name="lock"/>{t('private')}</p></>}
        {entryKind === 'feedback' && <label>{t('owner')}<select name="recipient" required>{task?.assignees.map(id => <option key={id} value={id}>{project.members.find(m => m.id === id)?.name}</option>)}</select></label>}
        <small className="r-demo-disclaimer">{t('demoOnly')}</small>
        {(panel === 'project' || (panel === 'settings' ? isMentor : writable)) && <button className="button" type="submit">{t(panel === 'invite' ? 'inviteAction' : panel === 'task' || (panel === 'meeting' && !meeting) ? 'publish' : 'save')}</button>}
      </form>}
    </SideDrawer>
    {toast && <div role="status" className="r-toast">{toast}</div>}
  </div>;
}

// This isolated preview must never call a production API, even with stale local credentials.
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/api')) return Promise.reject(new Error('Research demo: networking disabled'));
  return originalFetch(input, init);
};
await activateLanguage(locale === 'zh' ? 'zh-CN' : 'en');
await document.fonts.load('24px "Material Symbols Outlined"');
document.documentElement.classList.add('material-symbols-ready');
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><LanguageProvider><ThemeProvider><App/></ThemeProvider></LanguageProvider></AuthProvider></BrowserRouter>);
