import type { ResearchMember, ResearchTask } from '../lib/research';
import { useI18n, type TranslationKey } from '../lib/language';

export function ResearchTaskItem({task,members,selected=false,onClick}:{
  task:ResearchTask;members:ResearchMember[];selected?:boolean;onClick:()=>void;
}) {
  const {t}=useI18n();
  void members;
  return <button className={`research-task-row${selected?' selected':''}`} type="button" aria-current={selected?'true':undefined} onClick={onClick}>
    <span className={`research-task-symbol material-symbols-outlined is-${task.status}`} aria-hidden="true">{task.status==='archived'?'inventory_2':'assignment'}</span>
    <span className="research-task-row-copy"><strong>{task.title}</strong>
      <span className="research-task-row-meta"><span>{Object.keys(task.reporting||{}).map(kind=>t(`researchFlow.${kind}` as TranslationKey)).join(' · ')}</span><span>{task.status==='archived'?t('research.archived'):task.end||t('research.openEnd')}</span></span>
    </span>
    <span className="material-symbols-outlined research-chevron" aria-hidden="true">chevron_right</span>
  </button>;
}
