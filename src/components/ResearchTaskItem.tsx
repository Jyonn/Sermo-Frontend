import type { ResearchMember, ResearchTask } from '../lib/research';
import { useI18n } from '../lib/language';
import { UserAvatar } from './UserAvatar';

export function ResearchTaskItem({task,members,selected=false,onClick}:{
  task:ResearchTask;members:ResearchMember[];selected?:boolean;onClick:()=>void;
}) {
  const {t}=useI18n();
  const people=members.filter(member=>task.assignees.includes(member.id));
  return <button className={`research-task-row${selected?' selected':''}`} type="button" aria-current={selected?'true':undefined} onClick={onClick}>
    <span className={`research-task-symbol material-symbols-outlined is-${task.status}`} aria-hidden="true">{task.status==='archived'?'inventory_2':'assignment'}</span>
    <span className="research-task-row-copy"><strong>{task.title}</strong>
      <span className="research-task-row-meta"><span className="research-task-people" title={people.map(member=>member.name).join(' · ')}>{people.slice(0,3).map(member=><UserAvatar key={member.id} className="research-task-person" name={member.name} uri={member.avatar_uri} cacheKey={member.avatar_cache_key} frame={member.avatar_frame_style}/>)}</span><span>{task.status==='archived'?t('research.archived'):task.end||t('research.openEnd')}</span></span>
    </span>
    <span className="material-symbols-outlined research-chevron" aria-hidden="true">chevron_right</span>
  </button>;
}
