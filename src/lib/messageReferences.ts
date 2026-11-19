export type MessageReference = {kind:'profile';profile_user_id:number} | {kind:'research_task'|'research_comment'|'research_reply';project_id:number;task_id:string;progress_id?:string};
export const referenceTypes = {profile:15,research_task:16,research_comment:17,research_reply:18} as const;
export function researchReferencePath(reference:{project_id?:number;task_id?:string;progress_id?:string}) {
  const query=new URLSearchParams({project:String(reference.project_id),task:reference.task_id||''});
  if(reference.progress_id)query.set('progress',reference.progress_id);
  return `/app/research?${query}`;
}
