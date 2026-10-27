import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SideDrawer } from '../../src/components/SideDrawer';
import { BottomSheet } from '../../src/components/BottomSheet';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { useTheme } from '../../src/lib/theme';
import { seed, friends, mentor, createProject, inviteMembers, removeMember, transferProject, validRange, progressFor, meetingConflict, type Project, type Task, type Asset, type Progress } from './model';
import { readProjects, saveProjects } from './storage';
import { Markdown, safeUrl } from './Markdown';
import { Editor, readFile } from './Editor';
import { MarkdownInput } from './MarkdownInput';
import { t, language, type CopyKey } from './copy';
const Icon = ({ name }: {
    name: string;
}) => <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
const Avatar = ({ name }: {
    name: string;
}) => <span className="r-avatar">{name.slice(0, 1)}</span>;
const format = (date: string | null) => date ? new Date(date.length === 10 ? `${date}T12:00:00+08:00` : date).toLocaleDateString(language === 'en' ? 'en-GB' : 'zh-CN', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Shanghai' }) : t('openEnd');
type Tab = 'timeline' | 'tasks' | 'resources' | 'calendar';
type Panel = null | 'project' | 'task' | 'resource' | 'node' | 'meeting' | 'details' | 'group' | 'appearance';
function Period({ start = '2026-10-27', end = '2027-05-31', timed = false, long = true }: {
    start?: string;
    end?: string | null;
    timed?: boolean;
    long?: boolean;
}) {
    const [open, setOpen] = useState(end === null);
    return <fieldset className="v3-period">
<legend>{t('range')}</legend>
<label>{t('start')}<input name="start" type={timed ? 'datetime-local' : 'date'} defaultValue={start} required/>
</label>
<label>{t('end')}<input name="end" type={timed ? 'datetime-local' : 'date'} defaultValue={end || ''} disabled={open} required={!open}/>
</label>{long && <label className="v3-check">
<input type="checkbox" checked={open} onChange={e => setOpen(e.target.checked)}/>{t('openEnd')}</label>}</fieldset>;
}
function AttachmentList({ assets }: {
    assets: Asset[];
}) { return <div className="v3-assets">{assets.map(asset => <a key={asset.id} href={asset.kind === 'link' ? safeUrl(asset.url) : asset.url} target={asset.kind === 'link' ? '_blank' : undefined} rel="noreferrer" download={asset.kind === 'file' ? asset.name : undefined}>
<Icon name={asset.kind === 'link' ? 'link' : 'description'}/>
<span>{asset.name}</span>
<Icon name={asset.kind === 'link' ? 'arrow_outward' : 'download'}/>
</a>)}</div>; }
function AssetPicker({ assets, onChange, error }: {
    assets: Asset[];
    onChange: (a: Asset[]) => void;
    error: (text: string) => void;
}) {
    const [link, setLink] = useState(false);
    return <div className="v3-asset-picker">
<AttachmentList assets={assets}/>
<div className="v3-inline-actions">
<label className="v3-upload">
<Icon name="attach_file"/>{t('addFile')}<input type="file" multiple onChange={async (e) => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.some(file => file.size > 8 * 1024 * 1024))
        return error(t('fileLimit')); try {
        onChange([...assets, ...await Promise.all(files.map(async (file, index) => ({ id: Date.now() + index, name: file.name, kind: 'file' as const, url: await readFile(file) })))]);
    }
    catch {
        error(t('storageError'));
    } }}/>
</label>
<button type="button" className="r-text-button" onClick={() => setLink(!link)}>
<Icon name="link"/>{t('addLink')}</button>
</div>{link && <div className="v3-inline-link">
<input name="assetName" aria-label={t('title')} placeholder={t('title')}/>
<input name="assetUrl" type="url" aria-label={t('url')} placeholder="https://…"/>
<button type="button" onClick={event => { const root = event.currentTarget.parentElement!; const name = root.querySelector<HTMLInputElement>('[name=assetName]')!; const url = root.querySelector<HTMLInputElement>('[name=assetUrl]')!; if (!name.value.trim() || !safeUrl(url.value))
        return error(t('invalid')); onChange([...assets, { id: Date.now(), name: name.value, kind: 'link', url: url.value }]); setLink(false); }}>{t('save')}</button>
</div>}</div>;
}
export function Workspace() {
    const hydrating = useRef(true);
    const { resolvedTheme, setPreference } = useTheme();
    const [projects, setProjects] = useState<Project[]>(seed), [ready, setReady] = useState(false), [viewer, setViewer] = useState(0), [projectId, setProjectId] = useState(1), [tab, setTab] = useState<Tab>('timeline'), [panel, setPanel] = useState<Panel>(null), [chooser, setChooser] = useState(false), [selected, setSelected] = useState<number | null>(null), [scope, setScope] = useState('mine'), [reply, setReply] = useState<number | null>(null), [toast, setToast] = useState(''), [draftAssets, setDraftAssets] = useState<Asset[]>([]), [meetingId, setMeetingId] = useState<number | null>(null), [slot, setSlot] = useState('2026-10-29T14:00'), [scheduleDate, setScheduleDate] = useState('2026-10-29'), [invite, setInvite] = useState(false), [confirm, setConfirm] = useState<{
        text: string;
        action: () => void;
    } | null>(null), [lightbox, setLightbox] = useState<string | null>(null);
    const currentUser = [mentor, ...friends].find(m => m.id === viewer) || mentor;
    const visible = projects.filter(p => p.members.some(m => m.id === viewer));
    const p = visible.find(p => p.id === projectId) || visible[0];
    const owner = p?.owner === viewer, writable = p?.status !== 'completed';
    const task = p?.tasks.find(task => task.id === selected);
    const update = (fn: (p: Project) => Project) => setProjects(items => items.map(item => item.id === p?.id ? fn(item) : item));
    const tell = (text: string) => setToast(text);
    const close = () => { setPanel(null); setDraftAssets([]); setInvite(false); };
    const open = (next: Panel) => { setDraftAssets([]); setPanel(next); };
    useEffect(() => { let alive = true; hydrating.current=true; readProjects().then(saved => { if (alive && saved !== undefined)
        setProjects(saved); }).catch(() => tell(t('storageError'))).finally(() => { if (alive) { hydrating.current=false;
        setReady(true); } }); return () => { alive = false; }; }, []);
    useEffect(() => { if (ready && !hydrating.current)
        void saveProjects(projects).catch(() => tell(t('storageError'))); }, [projects, ready]);
    useEffect(() => { if (!toast)
        return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
    useEffect(() => { setScope('mine'); setReply(null); setSelected(null); }, [viewer, p?.id]);
    useEffect(() => { const params = new URLSearchParams(location.search); if (params.has('light'))
        setPreference('light');
    else if (params.has('dark'))
        setPreference('dark'); }, []);
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const value = (key: string) => String(data.get(key) || '').trim();
        const ids = data.getAll('member').map(Number);
        const start = value('start'), end = value('end') || null;
        if (panel === 'project') {
            if (!value('title') || !validRange(start, end))
                return tell(t('invalid'));
            const created = createProject(value('title'), value('description'), start, end, currentUser);
            setProjects(items => [...items, created]);
            setProjectId(created.id);
            setTab('timeline');
        }
        else if (p && owner && writable && panel === 'task') {
            if (!value('title') || !validRange(start, end) || !ids.length)
                return tell(t('invalid'));
            update(p => ({ ...p, tasks: [...p.tasks, { id: Date.now(), title: value('title'), body: value('body'), start, end, assignees: ids, status: 'todo', assets: draftAssets, comments: [] }] }));
            setTab('tasks');
        }
        else if (p && owner && writable && panel === 'node') {
            update(p => ({ ...p, timeline: [...p.timeline, { id: Date.now(), title: value('title'), date: value('date'), kind: value('kind') as 'deadline' | 'milestone' }] }));
            setTab('timeline');
        }
        else if (p && writable && panel === 'resource') {
            if (!draftAssets.length)
                return tell(t('invalid'));
            update(p => ({ ...p, resources: [...p.resources, ...draftAssets] }));
            setTab('resources');
        }
        else if (p && owner && writable && panel === 'meeting') {
            if (!value('title') || !end || !validRange(start, end) || start === end || !ids.length)
                return tell(t('invalid'));
            if (meetingConflict(p,start,end,ids)) return tell(t('invalid'));
            update(p => ({ ...p, meetings: [...p.meetings, { id: Date.now(), title: value('title'), start, end, attendees: ids, place: value('place'), agenda: value('body'), minutes: '' }] }));
            setTab('calendar');
        }
        else
            return;
        close();
        tell(t('saved'));
    }
    function addProgress(body: string, images: string[]) { if (!p || !task || !writable)
        return; const comment: Progress = { id: Date.now(), owner: viewer, body, images, at: new Date().toISOString(), ...(reply ? { replyTo: reply } : {}) }; update(p => ({ ...p, tasks: p.tasks.map(item => item.id === task.id ? { ...item, comments: [...item.comments, comment] } : item) })); setReply(null); tell(t('saved')); }
    const identity = <select className="v3-identity" aria-label={t('role')} value={viewer} onChange={e => { setViewer(Number(e.target.value)); close(); }}>{[mentor, ...friends].map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>;
    if (!ready)
        return <div className="v3-loading">{t('loading')}</div>;
    return <div className="research-demo v3-demo">
    <aside className="r-nav">
<a className="r-brand" href="./index.html">
<img src="/icons/frienden-app-192-v3.png" alt="Frienden"/>
<span>Frienden<small>友间</small>
</span>
</a>
<nav aria-label="Frienden">{([['chats', 'chat'], ['square', 'explore'], ['submissions', 'outbox'], ['contacts', 'forum'], ['research', 'science'], ['menu', 'menu']] as const).map(([key, icon]) => <button key={key} aria-label={t(key)} className={key === 'research' ? 'active' : ''} onClick={() => key === 'menu' ? open('appearance') : key === 'research' ? setTab('timeline') : tell(t('previewOnly'))}>
<Icon name={icon}/>
<span>{t(key)}</span>
</button>)}</nav>
<div className="r-nav-bottom">
<Avatar name={currentUser.name}/>{identity}</div>
</aside>
    <main className="r-workspace">
      <header className="r-header">
<button className="r-project-button" aria-label={t('project')} onClick={() => setChooser(true)}>
<span className="r-project-mark">
<Icon name="science"/>
</span>
<span>
<small>{t('research')} · {p ? t(p.status) : t('newProject')}</small>
<strong>{p?.title || t('newProject')}</strong>
</span>
<Icon name="unfold_more"/>
</button>
<div className="r-header-actions">{p && <>
<button className="r-icon" aria-label={t('discussion')} onClick={() => open('group')}>
<Icon name="forum"/>
</button>
<button className="r-icon" aria-label={t('details')} onClick={() => open('details')}>
<Icon name="more_horiz"/>
</button>
</>}</div>
</header>
      <div className="r-preview-label">
<span>{t('preview')}</span>
<span>{currentUser.name} · {t(owner ? 'mentor' : 'student')}</span>
</div>
      {p ? <>
<div className="v3-context">
<span>
<Icon name="date_range"/>{format(p.start)} — {format(p.end)}</span>
<button onClick={() => open('details')}>
<Icon name="group"/>{p.members.length}</button>
</div>
      <div className="v3-tabs" role="tablist" aria-label={t('research')}>{(['timeline', 'tasks', 'resources', 'calendar'] as Tab[]).map(value => <button role="tab" aria-selected={tab === value} key={value} onClick={() => { setTab(value); setSelected(null); }}>{t(value)}</button>)}</div>
      <div className={`v3-main ${tab === 'tasks' ? 'v3-task-layout' : ''} ${task ? 'has-detail' : ''}`}>
        {tab === 'timeline' && <section className="v3-timeline-page">
<div className="v3-page-heading">
<div>
<span className="v3-kicker">{t('timeline')}</span>
<h1>{p.description}</h1>
</div>{owner && writable && <button className="button secondary" onClick={() => open('node')}>
<Icon name="add"/>{t('node')}</button>}</div>
<div className="v3-timeline">{[{ id: 0, title: t('start'), date: p.start, kind: 'milestone' }, ...p.timeline, ...p.meetings.map(meeting => ({ id: meeting.id, title: meeting.title, date: meeting.start.slice(0, 10), kind: 'meeting' })), ...(p.end ? [{ id: -1, title: t('end'), date: p.end, kind: 'milestone' }] : [])].sort((a, b) => a.date.localeCompare(b.date)).map((node, index) => <article key={`${node.kind}-${node.id}`} className={node.kind === 'deadline' ? 'is-deadline' : ''}>
<time>{format(node.date)}</time>
<span className="v3-timeline-point">
<Icon name={node.kind === 'deadline' ? 'flag' : node.kind === 'meeting' ? 'event' : 'radio_button_checked'}/>
</span>
<div>
<small>{node.kind === 'meeting' ? t('meeting') : node.kind === 'deadline' ? t('deadline') : t('milestone')}</small>
<h3>{node.title}</h3>
</div>
</article>)}</div>
</section>}
        {tab === 'tasks' && <>
<section className="r-task-list">
<div className="v3-section-heading">
<h2>{t('tasks')}</h2>{owner && writable && <button className="r-icon r-new" aria-label={t('newTask')} onClick={() => open('task')}>
<Icon name="add"/>
</button>}</div>{p.tasks.map(item => <button className={`r-task-row ${task?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => { setSelected(item.id); setScope('mine'); setReply(null); }}>
<Icon name={item.status === 'done' ? 'check_circle' : 'radio_button_unchecked'}/>
<span className="r-task-row-body">
<strong>{item.title}</strong>
<span>{item.assignees.map(id => p.members.find(member => member.id === id)?.name).join('、')}</span>
<small>{format(item.start)} — {format(item.end)}</small>
<span className={`r-status ${item.status}`}>{t(item.status)}</span>
</span>
<Icon name="chevron_right"/>
</button>)}{!p.tasks.length && <p className="r-empty">{t('empty')}</p>}</section>
        <section className="v3-task-detail">{task ? <>
<header className="v3-detail-top">
<button className="r-icon" aria-label={t('back')} onClick={() => setSelected(null)}>
<Icon name="arrow_back"/>
</button>
<span className={`r-status ${task.status}`}>{t(task.status)}</span>
<span className="v3-spacer"/>{owner && writable && <select aria-label={t('status')} value={task.status} onChange={e => update(p => ({ ...p, tasks: p.tasks.map(item => item.id === task.id ? { ...item, status: e.target.value as Task['status'] } : item) }))}>{(['todo', 'doing', 'done'] as const).map(status => <option value={status} key={status}>{t(status)}</option>)}</select>}</header>
<div className="v3-detail-scroll">
<h1>{task.title}</h1>
<div className="v3-task-info">
<span>
<Icon name="group"/>{task.assignees.map(id => p.members.find(m => m.id === id)?.name).join('、')}</span>
<span>
<Icon name="date_range"/>{format(task.start)} — {format(task.end)}</span>
</div>
<Markdown body={task.body}/>
<AttachmentList assets={task.assets}/>
<div className="v3-progress-heading">
<h2>{t('progress')}</h2>
<select aria-label={t('progress')} value={scope} onChange={e => setScope(e.target.value)}>
<option value="mine">{t('mine')}</option>
<option value="all">{t('everyone')}</option>{p.members.filter(m => m.id !== viewer).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
</div>
<p className="v3-muted">{t('privateHint')}</p>
          {progressFor(task, scope === 'mine' ? viewer : Number(scope), scope === 'all' ? 'all' : 'mine').map(comment => <article className="v3-comment" key={comment.id}>
<div className="v3-comment-head">
<Avatar name={p.members.find(m => m.id === comment.owner)?.name || '·'}/>
<strong>{p.members.find(m => m.id === comment.owner)?.name || '·'}</strong>
<time>{new Date(comment.at).toLocaleString(language === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
</div>{comment.replyTo && <div className="v3-quote">
<small>{t('replying')}</small>
<Markdown body={task.comments.find(c => c.id === comment.replyTo)?.body || '…'}/>
</div>}<Markdown body={comment.body}/>{comment.images.length > 0 && <div className="v3-comment-images">{comment.images.map((image, index) => <button key={index} onClick={() => setLightbox(image)}>
<img src={image} alt={`${t('imageAlt')} ${index + 1}`}/>
</button>)}</div>}{writable && <button className="r-text-button" onClick={() => setReply(comment.id)}>{t('reply')}</button>}{reply === comment.id && <Editor key={`reply-${comment.id}`} label={t('replying')} onCancel={() => setReply(null)} onSend={addProgress}/>}</article>)}
          {!progressFor(task, scope === 'mine' ? viewer : Number(scope), scope === 'all' ? 'all' : 'mine').length && <p className="r-empty">{t('noProgress')}</p>}
          {writable && !reply && <Editor key={`${task.id}-${viewer}`} onSend={addProgress}/>}</div>
</> : <div className="r-idle">
<Icon name="assignment"/>
<h2>{t('tasks')}</h2>
<p>{t('empty')}</p>
</div>}</section>
</>}
        {tab === 'resources' && <section className="v3-page">
<div className="v3-page-heading">
<h1>{t('resources')}</h1>{writable && <button className="button secondary" onClick={() => open('resource')}>
<Icon name="add"/>{t('resource')}</button>}</div>
<AttachmentList assets={p.resources}/>{!p.resources.length && <p className="r-empty">{t('empty')}</p>}</section>}
        {tab === 'calendar' && <section className="v3-page">
<div className="v3-page-heading">
<div>
<h1>{t('chronelle')}</h1>
<p className="v3-muted">{t('scheduleHint')}</p>
</div>
<input aria-label={t('date')} type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}/>
</div>
<div className="v3-availability-wrap">
<table className="v3-availability">
<thead>
<tr>
<th>{t('selectTime')}</th>{p.members.map(m => <th key={m.id}>{m.name}</th>)}<th>{t('available')}</th>
</tr>
</thead>
<tbody>{Array.from({ length: 8 }, (_, index) => index + 9).map((hour) => { const busy = p.members.map(m => (hour + m.id + new Date(scheduleDate + 'T12:00').getDay()) % 5 === 0 || meetingConflict(p,`${scheduleDate}T${String(hour).padStart(2,'0')}:00`,`${scheduleDate}T${String(hour+1).padStart(2,'0')}:00`,[m.id])); return <tr key={hour}>
<th>{hour}:00</th>{p.members.map((m, index) => <td key={m.id}>
<span className={busy[index] ? 'busy' : 'free'}>{t(busy[index] ? 'busy' : 'free')}</span>
</td>)}<td>
<button disabled={!owner || !writable || busy.some(Boolean) || !scheduleDate} onClick={() => { setSlot(`${scheduleDate}T${String(hour).padStart(2, '0')}:00`); open('meeting'); }}>{t('book')}</button>
</td>
</tr>; })}</tbody>
</table>
</div>
<p className="v3-muted">{t('scheduleOnly')}</p>
<div className="v3-page-heading">
<h2>{t('upcoming')}</h2>{owner && writable && <button className="button secondary" onClick={() => open('meeting')}>{t('meeting')}</button>}</div>{[...p.meetings].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).map(meeting => <article className="v3-meeting" key={meeting.id}>
<button className="v3-meeting-toggle" aria-expanded={meetingId === meeting.id} onClick={() => setMeetingId(meetingId === meeting.id ? null : meeting.id)}>
<Icon name="event"/>
<span>
<small>{format(meeting.start)} · {meeting.start.slice(11)} — {meeting.end.slice(11)}</small>
<strong>{meeting.title}</strong>
<small>{meeting.place}</small>
</span>
<Icon name={meetingId === meeting.id ? 'expand_less' : 'expand_more'}/>
</button>{meetingId === meeting.id && <div className="v3-meeting-body">
<p className="v3-muted">{meeting.attendees.map(id => p.members.find(m => m.id === id)?.name).join('、')}</p>
<Markdown body={meeting.agenda}/>
<h3>{t('minutes')}</h3>
<Markdown body={meeting.minutes}/>{writable && <Editor pictures={false} retainAfterSend label={t('minutes')} initial={meeting.minutes} onSend={body => { update(p => ({ ...p, meetings: p.meetings.map(item => item.id === meeting.id ? { ...item, minutes: body } : item) })); tell(t('saved')); }}/>}</div>}</article>)}{!p.meetings.length && <p className="r-empty">{t('noMeetings')}</p>}</section>}
      </div>
</> : <div className="r-idle">
<h1>{t('newProject')}</h1>
<p>{t('newProjectHint')}</p>
<button className="button" onClick={() => open('project')}>{t('newProject')}</button>
</div>}
    </main>
    <BottomSheet open={chooser} title={t('project')} onClose={() => setChooser(false)} className="r-sheet">
<div className="r-project-list">{visible.map(project => <button className="v3-project-choice" key={project.id} onClick={() => { setProjectId(project.id); setTab('timeline'); setChooser(false); }}>
<Icon name="science"/>
<span>
<strong>{project.title}</strong>
<small>{t(project.status)} · {format(project.start)} — {format(project.end)}</small>
</span>
<Icon name={project.id === p?.id ? 'check' : 'chevron_right'}/>
</button>)}<button className="button secondary" onClick={() => { setChooser(false); open('project'); }}>{t('newProject')}</button>
</div>
</BottomSheet>
    <SideDrawer open={panel !== null} historyMode="route" onClose={close} title={t(panel === 'project' ? 'newProject' : panel === 'task' ? 'newTask' : panel === 'node' ? 'node' : panel === 'resource' ? 'resource' : panel === 'meeting' ? 'meeting' : panel === 'group' ? 'localChat' : panel === 'appearance' ? 'menu' : 'details')} className="r-editor v3-drawer" backdropClassName="r-editor-backdrop" headerAction={<button className="r-icon r-desktop-close" aria-label={t('close')} onClick={close}>
<Icon name="close"/>
</button>} trapFocus>
      {panel === 'details' && p ? <div className="r-form">
<div className="v3-group-identity">
<span className="r-project-mark">
<Icon name="science"/>
</span>
<h2>{p.title}</h2>
<small>{format(p.start)} — {format(p.end)}</small>
</div>
<label>{t('status')}<select disabled={!owner} value={p.status} onChange={e => update(p => ({ ...p, status: e.target.value as Project['status'] }))}>{(['planning', 'active', 'completed'] as const).map(status => <option key={status} value={status}>{t(status)}</option>)}</select>
</label>
<div className="v3-section-heading">
<h3>{t('members')} · {p.members.length}</h3>{owner && writable && <button className="r-text-button" onClick={() => setInvite(!invite)}>{t('invite')}</button>}</div>
<div>{p.members.map(member => <div className="v3-member" key={member.id}>
<Avatar name={member.name}/>
<span>
<strong>{member.name}</strong>{member.id === p.owner && <small>{t('owner')}</small>}</span>{owner && member.id !== p.owner && <button className="r-text-button" onClick={() => setConfirm({ text: t('removeConfirm'), action: () => update(p => removeMember(p, member.id)) })}>{t('remove')}</button>}</div>)}</div>{invite && <form className="v3-invite" onSubmit={event => { event.preventDefault(); const ids = new FormData(event.currentTarget).getAll('member').map(Number); update(p => inviteMembers(p, friends.filter(member => ids.includes(member.id)))); setInvite(false); tell(t('saved')); }}>
<p className="v3-muted">{t('inviteHint')}</p>{friends.filter(friend => !p.members.some(member => member.id === friend.id)).map(friend => <label className="v3-check" key={friend.id}>
<Avatar name={friend.name}/>{friend.name}<input type="checkbox" name="member" value={friend.id}/>
</label>)}<button className="button" type="submit">{t('inviteAction')}</button>
</form>}{owner && p.members.length > 1 && <label>{t('transfer')}<select value="" onChange={e => { const id = Number(e.target.value); if (e.target.value !== '')
            setConfirm({ text: t('transferConfirm'), action: () => update(p => transferProject(p, id)) }); }}>
<option value="">{t('assignees')}</option>{p.members.filter(member => member.id !== p.owner).map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
</label>}<div className="v3-lifecycle">{owner ? <button onClick={() => setConfirm({ text: t('deleteConfirm'), action: () => { setProjects(items => items.filter(item => item.id !== p.id)); close(); } })}>{t('dissolve')}</button> : <button onClick={() => setConfirm({ text: t('leaveConfirm'), action: () => { update(p => removeMember(p, viewer)); close(); } })}>{t('leave')}</button>}</div>
<small className="v3-muted">{t('sensitive')}</small>
</div>
            : panel === 'group' && p ? <div className="r-form">
<div className="v3-bound-note">
<Icon name="lock"/>
<strong>{t('bound')}</strong>
<p>{t('boundHint')}</p>
<button className="button secondary" onClick={() => open('details')}>{t('details')}</button>
</div>
<div className="v3-chat-messages">{p.messages.map(message => <article key={message.id}>
<Avatar name={p.members.find(m => m.id === message.owner)?.name || '·'}/>
<div>
<strong>{p.members.find(m => m.id === message.owner)?.name}</strong>
<Markdown body={message.body}/>
</div>
</article>)}</div>{writable && <Editor pictures={false} label={t('message')} onSend={body => update(p => ({ ...p, messages: [...p.messages, { id: Date.now(), owner: viewer, body }] }))}/>}</div>
                : panel === 'appearance' ? <div className="r-form">
<button className="button secondary" onClick={() => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')}>
<Icon name={resolvedTheme === 'dark' ? 'light_mode' : 'dark_mode'}/>{t('appearance')}</button>{identity}</div>
                    : <form className="r-form" key={panel} onSubmit={submit}>{panel === 'project' && <p className="v3-muted">{t('newProjectHint')}</p>}{panel !== 'resource' && <label>{t('title')}<input name="title" required maxLength={160}/>
</label>}{panel === 'project' && <>
<Period />
<label>{t('description')}<textarea name="description" rows={3}/>
</label>
</>}{panel === 'task' && <>
<Period start={p?.start}/>
<fieldset>
<legend>{t('assignees')}</legend>{p?.members.map(member => <label className="v3-check" key={member.id}>
<Avatar name={member.name}/>{member.name}<input type="checkbox" name="member" value={member.id}/>
</label>)}</fieldset>
<div><p className="v3-field-label">{t('body')}</p><MarkdownInput rows={8} required/></div>
<AssetPicker assets={draftAssets} onChange={setDraftAssets} error={tell}/>
</>}{panel === 'node' && <>
<label>{t('date')}<input name="date" type="date" required/>
</label>
<label>{t('kind')}<select name="kind">
<option value="milestone">{t('milestone')}</option>
<option value="deadline">{t('deadline')}</option>
</select>
</label>
</>}{panel === 'resource' && <AssetPicker assets={draftAssets} onChange={setDraftAssets} error={tell}/>}{panel === 'meeting' && <>
<Period timed long={false} start={slot} end={`${slot.slice(0, 11)}${String(Number(slot.slice(11, 13)) + 1).padStart(2, '0')}:00`}/>
<fieldset>
<legend>{t('attendees')}</legend>{p?.members.map(member => <label className="v3-check" key={member.id}>{member.name}<input type="checkbox" name="member" value={member.id} defaultChecked/>
</label>)}</fieldset>
<label>{t('place')}<input name="place" required/>
</label>
<div><p className="v3-field-label">{t('agenda')}</p><MarkdownInput rows={5}/></div>
</>}<button className="button" type="submit">{t(panel === 'project' ? 'create' : 'save')}</button>
</form>}
    </SideDrawer>
    <ConfirmDialog open={!!confirm} title={confirm?.text || ''} description={t('sensitive')} danger onClose={() => setConfirm(null)} onConfirm={() => { confirm?.action(); setConfirm(null); tell(t('saved')); }}/>
    {lightbox && <div className="v3-lightbox" role="dialog" aria-label={t('imageAlt')} onClick={() => setLightbox(null)}>
<button aria-label={t('close')} onClick={() => setLightbox(null)}>×</button>
<img src={lightbox} alt={t('imageAlt')}/>
</div>}
    {toast && <div className="r-toast" role="status">{toast}</div>}
  </div>;
}
