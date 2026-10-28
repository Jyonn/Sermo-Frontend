import { useState } from 'react';
import { useI18n } from '../lib/language';
import type { ResearchProject, ResearchSummary } from '../lib/research';
import { PageTabs } from './PageTabs';
import { ResearchMemberGrid } from './ResearchPeople';
import { QuietState } from './BoundaryState';
import { SettingGroup, SettingRow } from './SettingRow';

export function ResearchHome({ projects, selected, open, create }: { projects: ResearchSummary[]; selected?: number|null; open: (id: number) => void; create: () => void }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('all');
  const visible = projects.filter(item => filter === 'all' || item.status === filter);
  return <>
    <div className="research-home-tabs"><PageTabs label={t('research.project')} value={filter} onChange={setFilter}
      items={(['allItems', 'active', 'planning', 'completed'] as const).map(key => ({ value: key==='allItems'?'all':key, label: t(`research.${key}`) }))}/></div>
    <div className="research-home-scroll">
      {visible.length ? <div className="research-project-list">{visible.map(item => <button className={`research-project-item${selected===item.id?' is-selected':''}`} aria-current={selected===item.id?'true':undefined} key={item.id} onClick={() => open(item.id)}>
        <span className="research-project-symbol material-symbols-outlined" aria-hidden="true">{item.status === 'completed' ? 'inventory_2' : 'science'}</span>
        <span className="research-project-copy"><strong>{item.title}</strong><span>{item.start} <span aria-hidden="true">—</span> {item.end || t('research.openEnd')}</span></span>
        <span className={`research-status is-${item.status}`}>{t(`research.${item.status}`)}</span><span className="material-symbols-outlined research-chevron" aria-hidden="true">chevron_right</span>
      </button>)}</div> : <QuietState icon="science" title={t(projects.length ? 'research.noProjectsInStatus' : 'research.empty')} description={t('research.intro')} action={<button className="button" onClick={create}>{t('research.create')}</button>}/>}
    </div>
  </>;
}

export function ResearchOverview({ project, tasks, chat, calendar, members, addTask, canEdit }: { project: ResearchProject; tasks: (id?: string) => void; chat:()=>void; calendar: () => void; members: () => void; addTask: () => void; canEdit: boolean }) {
  const { t } = useI18n();
  const done = project.tasks.filter(item => item.status === 'done').length;
  const active = project.tasks.filter(item => item.status !== 'done');
  return <div className="research-overview">
    <section className="research-project-intro">
      <header className="research-section-heading"><h2>{t('research.team')} · {project.members.length}</h2><button className="ghost-button" onClick={members}>{t('research.viewAll')}<span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button></header>
      <ResearchMemberGrid members={project.members.slice(0,5)}/>
      {project.description && <p>{project.description}</p>}
      <SettingGroup><SettingRow title={t('research.group')} icon={<span className="material-symbols-outlined">forum</span>} onClick={chat}/></SettingGroup>
    </section>
    <div className="research-overview-columns"><section className="research-overview-tasks"><header className="research-section-heading"><h2>{t('research.tasks')}</h2><span className="research-muted">{done} / {project.tasks.length}</span><button className="ghost-button" onClick={() => tasks()}>{t('research.viewAll')}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button></header>
      <progress className="research-completion" value={done} max={project.tasks.length || 1} aria-label={t('research.tasks')}/>
      {active.slice(0, 4).map(item => <button className="research-overview-task" key={item.id} onClick={() => tasks(item.id)}><span className={`research-task-dot is-${item.status}`} aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.end || t('research.openEnd')}</small></span><span className={`research-status is-${item.status}`}>{t(`research.${item.status}`)}</span></button>)}
      {!active.length && <QuietState icon="assignment_turned_in" title={t(project.tasks.length ? 'research.allTasksDone' : 'research.noTasks')} description={t('research.taskEmptyHint')}/>}
      {canEdit && <button className="ghost-button research-add-task" onClick={addTask}><span className="material-symbols-outlined" aria-hidden="true">add</span>{t('research.addTask')}</button>}
    </section><aside className="research-overview-aside"><SettingGroup><SettingRow title={t('research.calendar')} description={t('research.calendarShortcut')} icon={<span className="material-symbols-outlined">calendar_month</span>} onClick={calendar}/></SettingGroup></aside></div>
  </div>;
}
