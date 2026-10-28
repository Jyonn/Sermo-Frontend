import { useI18n } from '../lib/language';
import type { ResearchProject, ResearchSummary } from '../lib/research';
import { UserAvatar } from './UserAvatar';
import { Markdown } from './ResearchMarkdown';
import { ResearchTaskItem } from './ResearchTaskItem';
import { HeaderIconButton } from './HeaderIconButton';
import { QuietState } from './BoundaryState';
import { SettingGroup, SettingRow } from './SettingRow';

export function ResearchHome({ projects, selected, open, create }: { projects: ResearchSummary[]; selected?: number|null; open: (id: number) => void; create: () => void }) {
  const { t } = useI18n();
  const visible = [...projects].sort((a,b) => Number(a.status === 'archived') - Number(b.status === 'archived'));
  return <>
    <div className="research-home-scroll">
      {visible.length ? <div className="research-project-list">{visible.map(item => <button className={`research-project-item${selected===item.id?' is-selected':''}`} aria-current={selected===item.id?'true':undefined} key={item.id} onClick={() => open(item.id)}>
        <span className="research-project-symbol material-symbols-outlined" aria-hidden="true">{item.status === 'archived' ? 'inventory_2' : 'science'}</span>
        <span className="research-project-copy"><strong>{item.title}</strong><span>{item.start} <span aria-hidden="true">—</span> {item.end || t('research.openEnd')}</span></span>
        <span className={`research-status is-${item.status}`}>{t(`research.${item.status}`)}</span><span className="material-symbols-outlined research-chevron" aria-hidden="true">chevron_right</span>
      </button>)}</div> : <QuietState icon="science" title={t(projects.length ? 'research.noProjectsInStatus' : 'research.empty')} description={t('research.intro')} action={<button className="button" onClick={create}>{t('research.create')}</button>}/>}
    </div>
  </>;
}

export function ResearchOverview({ project, tasks, chat, calendar, members, editDescription, addTask, canEdit }: { project: ResearchProject; tasks: (id?: string) => void; chat:()=>void; calendar: () => void; members: () => void; editDescription:()=>void; addTask: () => void; canEdit: boolean }) {
  const { t } = useI18n();
  const done = project.tasks.filter(item => item.status === 'archived').length;
  const active = project.tasks.filter(item => item.status !== 'archived');
  return <div className="research-overview">
    <section className="research-project-intro">
      <button type="button" className="research-member-stack" onClick={members} aria-label={`${t('research.team')} · ${project.members.length}`}>
        <span className="research-member-stack-avatars">{project.members.slice(0,6).map(member=><UserAvatar key={member.id} className="research-overview-avatar" name={member.name} uri={member.avatar_uri} cacheKey={member.avatar_cache_key} frame={member.avatar_frame_style}/>)}</span>
        <span className="research-member-stack-count">{project.members.length}<span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></span>
      </button>
      <div className="research-description">{canEdit&&<HeaderIconButton label={t('research.editDescription')} onClick={editDescription}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14v6Z"/></svg></HeaderIconButton>}{project.description?<Markdown body={project.description}/>:<QuietState icon="edit_note" title={t('research.noDescription')} description={t('research.descriptionHint')}/>}</div>
      <SettingGroup><SettingRow title={t('research.group')} icon={<span className="material-symbols-outlined">forum</span>} onClick={chat}/></SettingGroup>
    </section>
    <div className="research-overview-columns"><section className="research-overview-tasks"><header className="research-section-heading"><h2>{t('research.tasks')}</h2><span className="research-muted">{done} / {project.tasks.length}</span><button className="ghost-button" onClick={() => tasks()}>{t('research.viewAll')}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button></header>
      <progress className="research-completion" value={done} max={project.tasks.length || 1} aria-label={t('research.tasks')}/>
      {active.slice(0, 4).map(item => <ResearchTaskItem key={item.id} task={item} members={project.members} onClick={()=>tasks(item.id)}/>)}
      {!active.length && <QuietState icon="assignment_turned_in" title={t(project.tasks.length ? 'research.allTasksDone' : 'research.noTasks')} description={t('research.taskEmptyHint')}/>}
      {canEdit && <button className="ghost-button research-add-task" onClick={addTask}><span className="material-symbols-outlined" aria-hidden="true">add</span>{t('research.addTask')}</button>}
    </section><aside className="research-overview-aside"><SettingGroup><SettingRow title={t('research.calendar')} description={t('research.calendarShortcut')} icon={<span className="material-symbols-outlined">calendar_month</span>} onClick={calendar}/></SettingGroup></aside></div>
  </div>;
}
