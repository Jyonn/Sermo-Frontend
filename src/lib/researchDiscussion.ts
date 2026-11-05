import type {ResearchProgress,ResearchProject} from './research';

export function researchDiscussionDay(createdAt:string){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(createdAt));}
export function matchesResearchDiscussion(entry:ResearchProgress,day:string,member:number|null){return (day==='all'||researchDiscussionDay(entry.created_at)===day)&&(member===null||entry.user_id===member);}

/** Only rewards linked to the newly accepted report qualify for its success toast. */
export function submittedReportRewards(previous:ResearchProject,next:ResearchProject,userId:number,taskId:string){
  const prior=new Set(previous.tasks.find(task=>task.id===taskId)?.progress.map(entry=>entry.id)||[]);
  const report=next.tasks.find(task=>task.id===taskId)?.progress.find(entry=>entry.user_id===userId&&entry.report_kind&&!prior.has(entry.id));
  return {report,awards:report?(next.workflow?.ledger||[]).filter(award=>award.user_id===userId&&award.origin==='report'&&award.source_id===report.id):[]};
}
