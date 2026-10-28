import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useI18n } from '../lib/language';
import type { ResearchProject, ResearchSummary } from '../lib/research';
import { PageTabs } from './PageTabs';
import { ResearchMemberGrid } from './ResearchPeople';

export function ResearchHome({ projects, open, create }: { projects: ResearchSummary[]; open: (id: number) => void; create: () => void }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('all');
  const visible = projects.filter(item => filter === 'all' || item.status === filter);
  return <>
    <div className="research-home-tabs"><PageTabs label={t('research.project')} value={filter} onChange={setFilter}
      items={(['allItems', 'active', 'planning', 'completed'] as const).map(key => ({ value: key==='allItems'?'all':key, label: t(`research.${key}`) }))}/></div>
    <div className="research-home-scroll">
      <div className="research-home-heading"><div><p className="research-eyebrow">{t('research.workspace')}</p><h1>{t('research.myProjects')}</h1></div><span className="research-count">{visible.length}</span></div>
      {visible.length ? <div className="research-project-list">{visible.map(item => <button className="research-project-item" key={item.id} onClick={() => open(item.id)}>
        <span className="research-project-symbol material-symbols-outlined" aria-hidden="true">{item.status === 'completed' ? 'inventory_2' : 'science'}</span>
        <span className="research-project-copy"><strong>{item.title}</strong><span>{item.start} <span aria-hidden="true">—</span> {item.end || t('research.openEnd')}</span></span>
        <span className={`research-status is-${item.status}`}>{t(`research.${item.status}`)}</span><span className="material-symbols-outlined research-chevron" aria-hidden="true">chevron_right</span>
      </button>)}</div> : <div className="research-empty"><span className="material-symbols-outlined" aria-hidden="true">science</span><h2>{t(projects.length ? 'research.noProjectsInStatus' : 'research.empty')}</h2><p>{t('research.intro')}</p><button className="button" onClick={create}>{t('research.create')}</button></div>}
    </div>
  </>;
}

export function ResearchOverview({ project, tasks, calendar, members, addTask, canEdit }: { project: ResearchProject; tasks: (id?: string) => void; calendar: () => void; members: () => void; addTask: () => void; canEdit: boolean }) {
  const { t } = useI18n();
  const done = project.tasks.filter(item => item.status === 'done').length;
  const active = project.tasks.filter(item => item.status !== 'done');
  return <div className="research-overview">
    <section className="research-project-intro"><div className="research-section-heading"><span className={`research-status is-${project.status}`}>{t(`research.${project.status}`)}</span><span className="research-muted">{project.start} — {project.end || t('research.openEnd')}</span></div>
      <h1>{project.title}</h1>{project.description && <p>{project.description}</p>}
      <div className="research-overview-actions"><Link className="button" to={`/app/chats/${project.chat_id}`}><span className="material-symbols-outlined" aria-hidden="true">forum</span>{t('research.group')}</Link><button className="ghost-button" onClick={members}><span className="material-symbols-outlined" aria-hidden="true">group</span>{t('research.team')} · {project.members.length}</button></div>
    </section>
    <div className="research-overview-columns"><section className="research-overview-tasks"><header className="research-section-heading"><h2>{t('research.tasks')}</h2><span className="research-muted">{done} / {project.tasks.length}</span><button className="ghost-button" onClick={() => tasks()}>{t('research.viewAll')}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button></header>
      <progress className="research-completion" value={done} max={project.tasks.length || 1} aria-label={t('research.tasks')}/>
      {active.slice(0, 4).map(item => <button className="research-overview-task" key={item.id} onClick={() => tasks(item.id)}><span className={`research-task-dot is-${item.status}`} aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.end || t('research.openEnd')}</small></span><span className={`research-status is-${item.status}`}>{t(`research.${item.status}`)}</span></button>)}
      {!active.length && <p className="research-muted research-inline-empty">{t(project.tasks.length ? 'research.allTasksDone' : 'research.noTasks')}</p>}
      {canEdit && <button className="ghost-button research-add-task" onClick={addTask}><span className="material-symbols-outlined" aria-hidden="true">add</span>{t('research.addTask')}</button>}
    </section><aside className="research-overview-aside"><button className="research-calendar-shortcut" onClick={calendar}><span className="material-symbols-outlined" aria-hidden="true">calendar_month</span><strong>{t('research.calendar')}</strong><p>{t('research.calendarShortcut')}</p><span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button><div className="research-team-preview"><h2>{t('research.team')}</h2><ResearchMemberGrid members={project.members.slice(0,5)}/><button className="ghost-button" onClick={members}>{t('research.viewAll')}</button></div></aside></div>
  </div>;
}
