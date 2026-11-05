import { useI18n } from '../lib/language';
import type { ResearchProject, ResearchSummary } from '../lib/research';
import {MemberAvatarStack} from './MemberAvatarStack';
import { Markdown } from './ResearchMarkdown';
import {ResearchTimeline,type ResearchMutation} from './ResearchWorkflow';
import { QuietState } from './BoundaryState';

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

export function ResearchOverview({project,chat,members,canEdit,mutate}:{project:ResearchProject;chat:()=>void;members:()=>void;canEdit:boolean;mutate:ResearchMutation}){
  const {t}=useI18n();
  return <div className="research-overview">
    <section className="research-team-bar"><MemberAvatarStack className="research-member-stack" members={project.members.map(member=>({id:member.id,name:member.name,uri:member.avatar_uri,cacheKey:member.avatar_cache_key}))} size={38} label={project.members.length} onClick={members} ariaLabel={t('research.team')}/><button className="research-team-chat" onClick={chat}><span className="material-symbols-outlined" aria-hidden="true">forum</span>{t('research.groupShort')}</button></section>
    <ResearchTimeline project={project} editable={canEdit} mutate={mutate}/>
    <section className="research-flow-section"><header><h2>{t('research.description')}</h2>{canEdit&&<button className="ghost-button" onClick={members}>{t('researchFlow.edit')}</button>}</header><div className="research-description">{project.description?<Markdown body={project.description}/>:<QuietState title={t('research.noDescription')}/>}</div></section>
  </div>;
}
