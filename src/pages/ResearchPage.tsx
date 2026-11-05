import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AppChrome } from '../components/AppChrome';
import {ResearchProjectHeader} from '../components/ResearchProjectHeader';
import { TabPageHeader } from '../components/TabPageHeader';
import { SideDrawer } from '../components/SideDrawer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SelectControl } from '../components/SettingRow';
import { Markdown } from '../components/ResearchMarkdown';
import { ResearchCalendar } from '../components/ResearchCalendar';
import { ResearchHome, ResearchOverview } from '../components/ResearchWorkspace';
import { PageTabs } from '../components/PageTabs';
import { FloatingDrawerScope } from '../components/DesktopPanelWorkspace';
import { HeaderIconButton } from '../components/HeaderIconButton';
import { ResearchCreateFlow, type ResearchDraft } from '../components/ResearchCreateFlow';
import { MarkdownEditorDialog } from '../components/MarkdownEditorDialog';
import { ResearchTaskItem } from '../components/ResearchTaskItem';
import {ResearchTaskEditor,ResearchTodos,ResearchReportForm,ResearchTools} from '../components/ResearchWorkflow';
import { ResearchComments } from '../components/ResearchComments';
import { ResearchResources } from '../components/ResearchResources';
import { ResearchResourceSummary } from '../components/ResearchResourceSummary';
import { DateRangeField } from '../components/DateRangeField';
import { MemberPickerSheet } from '../components/MemberPickerSheet';
import { ResearchProjectDetails } from '../components/ResearchProjectDetails';
import { ActionSheet } from '../components/ActionSheet';
import { QuietState } from '../components/BoundaryState';
import { api, ApiError } from '../lib/api';
import { showToast } from '../lib/toast';
import { authStorage } from '../lib/storage';
import { researchCreateRestriction } from '../lib/researchCreatePermission';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/language';
import { useSpaceFeatures } from '../lib/spaceFeatures';
import { selectResearchProject } from '../lib/researchNavigation';
import type { ReportKind, ResearchTodo, ResearchProject, ResearchSummary } from '../lib/research';
import type { UserDTO } from '../types';
import './ResearchPage.css';
import './ResearchWorkspaceLayout.css';
import '../components/ResearchOverviewDesign.css';
const EmbeddedChats = lazy(() => import('./ChatsPage'));

export default function ResearchPage() {
  const {t}=useI18n(),{session}=useAuth(),features=useSpaceFeatures();
  const [search,setSearch]=useSearchParams();
  const returning=sessionStorage.getItem(`chronelle:return-project:${session?.user.user_id}`);
  const memoryKey=`research:current:${session?.user.user_id}`;
  const [list,setList]=useState<ResearchSummary[]>([]),[project,setProject]=useState<ResearchProject|null>(null),[id,setId]=useState<number|null>(()=>Number(search.get('project')||returning||localStorage.getItem(memoryKey))||null),[taskId,setTaskId]=useState<string|null>(null);
  const [chatOpen,setChatOpen]=useState(false),[onboarding,setOnboarding]=useState(!!returning||search.has('onboarding'));
  const [resourceScope,setResourceScope]=useState<string|null>(null);
  const [resourceRefresh,setResourceRefresh]=useState(0);
  const [panel,setPanel]=useState<'create'|'manage'|'task'|'members'|'description'|'title'|null>(null),[friends,setFriends]=useState<UserDTO[]>([]),[scope,setScope]=useState('mine'),[tab,setTab]=useState(returning||search.has('onboarding')?'calendar':search.has('task')?'tasks':'overview');
  const [inviteOpen,setInviteOpen]=useState(false),[memberAction,setMemberAction]=useState<number|null>(null);
  const [memberPickerAction,setMemberPickerAction]=useState<'transfer'|'remove'|null>(null);
  const [listLoading,setListLoading]=useState(true),[loading,setLoading]=useState(!!id),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tick,setTick]=useState(0),[confirm,setConfirm]=useState<string|null>(null);
  const [editingTask,setEditingTask]=useState(false),[report,setReport]=useState<{taskId:string;kind:ReportKind}|null>(null),[toolsInitial,setToolsInitial]=useState<'reimbursements'|undefined>();
  const [browsing,setBrowsing]=useState(false);
  const userId=session?.user.user_id;
  const checkingCreate=useRef(false);
  async function startCreate(){
    if(checkingCreate.current||busy)return;
    checkingCreate.current=true;
    try {
      const me=await api.getUserMe();
      const current=authStorage.get()?.user;
      if(!current||current.user_id!==userId||current.space_id!==session?.user.space_id)return;
      const restriction=researchCreateRestriction(me);
      if(restriction){showToast(t(restriction.key,restriction.values),'error',4000);return;}
      setError('');setPanel('create');
    }catch(e){showToast(e instanceof Error?e.message:t('research.failed'),'error');}
    finally{checkingCreate.current=false;}
  }
  const owner=project?.members.some(m=>m.id===userId&&m.owner)===true;
  const writable=project?.status!=='archived';
  const task=project?.tasks.find(task=>task.id===taskId);
  const requestedProject=Number(search.get('project'))||null,requestedTask=search.get('task');
  useEffect(()=>{if(requestedProject)setId(requestedProject);if(requestedTask){setTaskId(requestedTask);setTab('tasks');}},[requestedProject,requestedTask]);
  useEffect(()=>{const chatId=Number(search.get('chat'));if(listLoading||!chatId)return;const target=list.find(item=>item.chat_id===chatId);if(target){setId(target.id);setSearch(params=>{params.delete('chat');params.set('project',String(target.id));return params;},{replace:true});}},[list,listLoading,search]);
  useEffect(()=>{if(project&&project.id===requestedProject&&search.get('details')==='1'){setPanel('members');setSearch(params=>{params.delete('details');return params;},{replace:true});}},[project,requestedProject,search]);
  const [dates,setDates]=useState<{taskId?:string;from:string;to:string}|null>(null);
  function openProject(value:number){setBrowsing(false);setId(value);setTab('overview');setScope('mine');setOnboarding(false);setError('');setPanel(null);setChatOpen(false);}
  useEffect(()=>{if(listLoading)return;const next=selectResearchProject(list,id);if(next!==id){setId(next);setError('');}},[list,listLoading,id]);
  useEffect(()=>{if(id)localStorage.setItem(memoryKey,String(id));},[id,memoryKey]);
  useEffect(()=>{if(search.has('panel'))setSearch(params=>{const stack=(params.get('panel')||'').split('/').filter(part=>part!=='research-project');if(stack.length)params.set('panel',stack.join('/'));else params.delete('panel');return params;},{replace:true});},[]);
  useEffect(()=>{if(!id&&listLoading)return;const sync=()=>{const url=new URL(window.location.href);const next=id?String(id):null;if(url.searchParams.get('project')!==next){if(next)url.searchParams.set('project',next);else url.searchParams.delete('project');window.history.replaceState(window.history.state,'',url);}};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[id,listLoading,search]);
  useEffect(()=>{if(!features.ready||!features.researchEnabled)return;const controller=new AbortController();setListLoading(true);setError('');api.researchList(controller.signal).then(setList).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setListLoading(false);});return()=>controller.abort();},[features.ready,features.researchEnabled,tick,userId]);
  useEffect(()=>{setProject(null);setTaskId(null);if(!id){setLoading(false);return;}const controller=new AbortController();setLoading(true);api.researchGet(id,controller.signal).then(p=>{if(!controller.signal.aborted){setProject(p);setScope(p.members.some(m=>m.id===userId&&m.owner)?'all':'mine');setTaskId(p.tasks.find(item=>item.id===search.get('task'))?.id||p.tasks.find(item=>item.status==='active')?.id||p.tasks[0]?.id||null);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[id,tick,userId]);
  useEffect(()=>{if(panel!=='members')return;const controller=new AbortController();setFriends([]);api.getFriends(controller.signal).then(setFriends).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[panel]);
  useEffect(()=>{
    if(!id)return;const controller=new AbortController();let inFlight=false;
    const refresh=async()=>{if(document.hidden||inFlight)return;inFlight=true;try{const next=await api.researchGet(id,controller.signal);if(!controller.signal.aborted)setProject(current=>current?.id===next.id&&next.revision>=current.revision?next:current);}catch{/* Preserve the current workspace during temporary connectivity loss. */}finally{inFlight=false;}};
    const visible=()=>{if(!document.hidden)void refresh();};const timer=window.setInterval(()=>void refresh(),60000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
    return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  },[id,userId]);
  async function mutate(body:Record<string,unknown>){if(!project||busy)return;setBusy(true);setError('');try{const next=await api.researchUpdate(project.id,project.revision,body);if(['leave','dissolve'].includes(String(body.action))){setList(items=>items.filter(item=>item.id!==project.id));setId(null);setProject(null);localStorage.removeItem(memoryKey);setTick(n=>n+1);}else {setProject(next);setList(items=>items.map(item=>item.id===next.id?next:item));if(body.action==='task'){const added=next.tasks.find(item=>!project.tasks.some(old=>old.id===item.id));if(added){setTaskId(added.id);setTab('tasks');}}}return true;}catch(e){if(e instanceof ApiError&&e.status===409){try{const latest=await api.researchGet(project.id);setProject(latest);setList(items=>items.map(item=>item.id===latest.id?latest:item));setError(t('research.changedRetry'));}catch{setError(t('research.failed'));}}else setError(e instanceof Error?e.message:t('research.failed'));return false;}finally{setBusy(false);}}
  async function createProject(body:ResearchDraft){
    if(busy)return false;setBusy(true);setError('');
    try{const created=await api.researchCreate(body);setList(old=>[created,...old]);setBrowsing(false);setId(created.id);setTab('calendar');setOnboarding(true);setPanel(null);return true;}
    catch(e){
      let message=e instanceof Error?e.message:t('research.failed');
      if(e instanceof ApiError&&e.status===403){
        message=t('research.createDenied');
        try{const restriction=researchCreateRestriction(await api.getUserMe());if(restriction)message=t(restriction.key,restriction.values);}catch{/* Keep the explicit permission fallback if refresh fails. */}
      }
      setError(message);showToast(message,'error',4000);return false;
    }
    finally{setBusy(false);}
  }
  async function inviteMembers(ids:number[]) {
    if(!project||busy)return false;
    setBusy(true);setError('');let current=project;
    try {
      for(const user_id of ids) {
        if(current.members.some(member=>member.id===user_id)||current.pending_invitee_ids?.includes(user_id))continue;
        current=await api.researchUpdate(current.id,current.revision,{action:'invite',user_id});
        setProject(current);
      }
      return true;
    }catch(e){setError(e instanceof Error?e.message:t('research.failed'));return false;}
    finally{setBusy(false);}
  }
  function completeOnboarding(){setOnboarding(false);sessionStorage.removeItem(`chronelle:return-project:${userId}`);setSearch(params=>{params.delete('onboarding');return params;},{replace:true});}
  if(features.ready&&!features.researchEnabled)return <Navigate replace to="/app/menu"/>;
  const memberName=(value:number)=>project?.members.find(m=>m.id===value)?.name||`#${value}`;
  const inviteCandidates=project?[...project.members.map(member=>({...member,locked:true})),...friends.filter(friend=>!project.members.some(member=>member.id===friend.user_id)).map(friend=>({id:friend.user_id,name:friend.name,avatar_uri:friend.avatar_uri,avatar_cache_key:friend.avatar_cache_key,avatar_frame_style:friend.avatar_frame_style,locked:project.pending_invitee_ids?.includes(friend.user_id),lockedLabel:t('research.invited'),description:t(friend.is_alive?'presence.online':'presence.offline')}))]:[];
  return <AppChrome title={t('research.title')} hideTopbar shellClassName="desktop-tab-shell research-workspace-shell"><section className="page-stack research-page research-direct-workspace">
    {id&&!browsing?<ResearchProjectHeader disabled={!project} title={project?.title||list.find(item=>item.id===id)?.title||t('common.loading')} onBack={()=>setBrowsing(true)} onMenu={()=>setPanel('members')}/>:<TabPageHeader title={t('research.title')} actions={<HeaderIconButton label={t('research.create')} onClick={()=>void startCreate()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></HeaderIconButton>}/>}

    {error&&<div className="research-error" role="alert">{error}<button type="button" className="ghost-button" onClick={()=>setTick(n=>n+1)}>{t('common.retry')}</button></div>}
    <FloatingDrawerScope><div className="research-project-surface">
    {browsing?<ResearchHome projects={list} open={openProject} create={()=>void startCreate()}/>:listLoading||loading?<p className="research-empty" role="status">{t('common.loading')}</p>:!list.length?<ResearchHome projects={[]} open={openProject} create={()=>void startCreate()}/>:!project?<QuietState icon="science" title={t('research.failed')}/>:<>
      <div className="research-project-navigation"><PageTabs label={t('research.project')} value={tab} onChange={setTab} items={(['overview','tasks','todo','calendar','tools'] as const).map(value=>({value,label:value==='todo'&&project.workflow?.todos.length?`${t('research.todo')} · ${project.workflow.todos.length}`:t(`research.${value}`)}))}/></div>
      {tab==='overview'?<ResearchOverview project={project} chat={()=>setChatOpen(true)} members={()=>setPanel('members')} canEdit={owner&&writable} mutate={mutate}/>:tab==='todo'?<ResearchTodos project={project} busy={busy} mutate={mutate} onReimburse={()=>{setToolsInitial('reimbursements');setTab('tools');}} onOpen={(todo:ResearchTodo)=>{if(todo.task_id){setTaskId(todo.task_id);setScope('all');setTab('tasks');if(['daily','weekly','monthly'].includes(todo.kind))setReport({taskId:todo.task_id,kind:todo.kind as ReportKind});}}}/>:tab==='tools'?<ResearchTools key={project.id+String(toolsInitial)} project={project} owner={owner} userId={userId!} busy={busy} mutate={mutate} mutationError={error} initial={toolsInitial} onResources={()=>setResourceScope('')}/>:tab==='calendar'?<ResearchCalendar key={`${project.id}-${userId}`} project={project} userId={userId!} onboarding={onboarding} onOnboarded={completeOnboarding}/>:<div className={`research-task-layout ${task?'has-detail':''}`}>
        <aside><header><span className="research-muted">{project.tasks.length} {t('research.tasks')}</span>{owner&&writable&&<HeaderIconButton label={t('research.addTask')} onClick={()=>{setEditingTask(false);setPanel('task');}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></HeaderIconButton>}</header>{[...project.tasks].sort((a,b)=>Number(a.status==='archived')-Number(b.status==='archived')).map(item=><ResearchTaskItem key={item.id} task={item} members={project.members} selected={taskId===item.id} onClick={()=>{setTaskId(item.id);setScope(owner?'all':'mine');}}/>)}{!project.tasks.length&&<QuietState icon="assignment" title={t('research.noTasks')} description={t('research.taskEmptyHint')}/>}</aside>
        <article className="research-task-detail">{task?<ResearchComments key={task.id} project={project} task={task} userId={userId!} scope={scope} writable={writable&&task.status!=='archived'} busy={busy} mutate={mutate} send={async (body,reply_to,response_to)=>await mutate({action:'progress',task_id:task.id,body,reply_to,response_to})===true}>
          <header className="research-task-heading"><button className="ghost-button research-back" onClick={()=>setTaskId(null)} aria-label={t('research.back')}><span className="material-symbols-outlined">arrow_back</span></button><h1>{task.title}</h1>{owner&&writable&&<HeaderIconButton label={t('researchFlow.edit')} onClick={()=>{setEditingTask(true);setPanel('task');}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-13 13H3v-5Z"/></svg></HeaderIconButton>}{owner&&writable?<SelectControl compact label={t('research.status')} disabled={busy} value={task.status} options={(['active','archived'] as const).map(value=>({value,label:t(`research.${value}`)}))} onChange={status=>mutate({action:'task_status',task_id:task.id,status}).then(()=>{})}/>:<span className={`research-status is-${task.status}`}>{t(`research.${task.status}`)}</span>}</header>
          <div className="research-task-meta"><span><span className="material-symbols-outlined" aria-hidden="true">group</span>{task.assignees.map(memberName).join(' · ')||t('research.unassigned')}</span><span className="research-task-dates"><span className="material-symbols-outlined" aria-hidden="true">date_range</span>{task.start} — {task.end||t('calendarDate.unset')}</span></div><div className="research-task-body"><Markdown body={task.body}/></div>
          {project.workflow?.reportable_task_ids.includes(task.id)&&<div className="research-flow-actions">{(['daily','weekly','monthly'] as const).map(kind=><button className="ghost-button" key={kind} disabled={task.progress.some(p=>p.user_id===userId&&p.report_kind===kind&&p.period_start===project.workflow?.report_periods[kind])} onClick={()=>setReport({taskId:task.id,kind})}>{t('researchFlow.writeReport',{kind:t(`researchFlow.${kind}`)})}</button>)}</div>}
          <ResearchResourceSummary projectId={project.id} taskId={task.id} refresh={resourceRefresh} onOpen={()=>setResourceScope(task.id)}/>
          <div className="research-progress-head"><h2 title={t('research.shared')}>{t('research.progress')}</h2><SelectControl compact label={t('research.progressFilter')} value={scope} onChange={setScope} options={[{value:'mine',label:t('research.mine')},{value:'all',label:t('research.all')}]}/></div>
        </ResearchComments>:<QuietState icon="assignment" title={t('research.chooseTask')} description={t('research.taskEmptyHint')}/>}</article>
      </div>}
    </>}
    </div></FloatingDrawerScope>
    <FloatingDrawerScope>
    {resourceScope!==null&&project&&<ResearchResources key={`${project.id}-${resourceScope}`} projectId={project.id} taskId={resourceScope} members={project.members} title={`${resourceScope?project.tasks.find(item=>item.id===resourceScope)?.title:project.title} · ${t('resources.title')}`} onClose={()=>{setResourceScope(null);setResourceRefresh(value=>value+1);}}/>}
    <SideDrawer historyKey="research-manage" open={panel==='manage'} onClose={()=>setPanel(null)} title={t('research.manageProjects')} headerAction={<HeaderIconButton label={t('research.create')} onClick={()=>void startCreate()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></HeaderIconButton>}><ResearchHome projects={list} selected={id} open={openProject} create={()=>void startCreate()}/></SideDrawer>
    <SideDrawer historyKey="research-chat" className="research-chat-drawer" headerless floatingBack={false} fullscreen open={chatOpen&&!!project} onClose={()=>setChatOpen(false)} title={t('research.group')}>
      {chatOpen&&project&&<Suspense fallback={<QuietState title={t('common.loading')}/>}><EmbeddedChats embeddedChat={{id:project.chat_id,onClose:()=>setChatOpen(false),onProjectDetails:()=>setPanel('members')}}/></Suspense>}
    </SideDrawer>
    <SideDrawer historyKey={panel==='task'?'research-task-create':'research-members'} open={panel==='task'||panel==='members'} fullscreen={panel==='task'} onClose={()=>setPanel(null)} title={t(panel==='members'?'research.members':editingTask?'researchFlow.editTask':'research.addTask')}>
      {error&&<p className="research-error" role="alert">{error}</p>}
      {panel==='members'&&project?<ResearchProjectDetails project={project} owner={owner} busy={busy}
        onTitle={()=>setPanel('title')} onDates={()=>setDates({from:project.start,to:project.end||''})}
        onDescription={()=>setPanel('description')} onMember={member=>setMemberAction(member.id)} onAdd={()=>setInviteOpen(true)}
        onRemove={()=>setMemberPickerAction('remove')} onTransfer={()=>setMemberPickerAction('transfer')}
        onChat={()=>{setPanel(null);setChatOpen(true);}} onDanger={()=>setConfirm(owner?'dissolve':'leave')}
        onStatus={async status=>{if(!await mutate({action:'settings',status}))throw new Error('Status update failed');}}/>
        :project&&<ResearchTaskEditor key={editingTask?task?.id:'new'} project={project} task={editingTask?task:undefined} busy={busy} onSave={async body=>{const ok=await mutate(body);if(ok)setPanel(null);return ok;}}/>}
    </SideDrawer>
    {memberPickerAction&&project&&<MemberPickerSheet title={t(memberPickerAction==='transfer'?'research.transferOwner':'research.remove')} members={project.members.filter(member=>!member.owner)} initial={[]} limit={1} allowEmpty={false} actionLabel={t('common.next')} onClose={()=>setMemberPickerAction(null)} onApply={ids=>{setConfirm(`${memberPickerAction}:${ids[0]}`);}}/>}
    {inviteOpen&&project&&<MemberPickerSheet allowEmpty={false} title={t('research.invite')} initial={[]} actionLabel={t('research.sendInvitation')} error={error} members={inviteCandidates} onClose={()=>setInviteOpen(false)} onApply={inviteMembers}/>}
    <ActionSheet open={memberAction!==null} title={memberName(memberAction||0)} onClose={()=>setMemberAction(null)} actions={[{key:'transfer',label:t('research.transfer'),disabled:busy||memberAction===userId,onSelect:()=>{setError('');setConfirm(`transfer:${memberAction}`);}},{key:'remove',label:t('research.remove'),danger:true,disabled:busy||memberAction===userId,onSelect:()=>setConfirm(`remove:${memberAction}`)}]}/>
    <ConfirmDialog open={!!confirm} title={confirm?.startsWith('transfer:')?t('research.transferConfirm',{name:memberName(Number(confirm.split(':')[1]))}):t('research.confirm')} description={t(confirm?.startsWith('transfer:')?'research.transferHint':'research.sensitive')} danger={!confirm?.startsWith('transfer:')} busy={busy} onClose={()=>{setConfirm(null);setError('');}} onConfirm={()=>{const [action,user]=String(confirm).split(':');void mutate({action,...(user?{user_id:Number(user)}:{})}).then(ok=>{if(ok){setConfirm(null);setPanel(null);if(action==='transfer')showToast(t('research.transferred'));}});}}>{error&&<p className="research-error" role="alert">{error}</p>}</ConfirmDialog>
    <SideDrawer open={!!report} historyKey="research-report" title={t(`researchFlow.${report?.kind||'daily'}`)} onClose={()=>{if(!busy)setReport(null);}}>{project&&report&&project.tasks.find(item=>item.id===report.taskId)&&<><ResearchReportForm key={report.taskId+report.kind} project={project} task={project.tasks.find(item=>item.id===report.taskId)!} kind={report.kind} busy={busy} onSave={async body=>{const ok=await mutate(body);if(ok){setReport(null);setTaskId(String(body.task_id));setScope('all');setTab('tasks');}return ok;}}/>{error&&<p className="research-error" role="alert">{error}</p>}</>}</SideDrawer>
    <SideDrawer open={panel==='title'} historyKey="research-title" title={t('research.name')} onClose={()=>setPanel(null)}>{project&&<form className="research-form" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);void mutate({action:'settings',title:data.get('title')}).then(ok=>{if(ok)setPanel(null);});}}><label>{t('research.name')}<input name="title" maxLength={50} required defaultValue={project.title}/></label>{error&&<p role="alert">{error}</p>}<button className="button" disabled={busy}>{t('research.save')}</button></form>}</SideDrawer>
    {panel==='description'&&project&&<MarkdownEditorDialog title={t('research.description')} initialValue={project.description} busy={busy} error={error} onClose={()=>setPanel(null)} onSave={value=>{void mutate({action:'settings',description:value}).then(ok=>{if(ok)setPanel(null);});}}/>}
    {panel==='create'&&<ResearchCreateFlow busy={busy} error={error} onClose={()=>setPanel(null)} onCreate={createProject}/>}
    <ConfirmDialog open={!!dates} title={t('research.editDates')} description="" busy={busy} confirmLabel={t('research.save')} onClose={()=>setDates(null)} onConfirm={()=>{if(dates)void mutate({action:dates.taskId?'task_dates':'settings',...(dates.taskId?{task_id:dates.taskId}:{}),start:dates.from,end:dates.to||null}).then(ok=>{if(ok)setDates(null);});}}>
      {dates&&<DateRangeField value={dates} onChange={range=>setDates(current=>current?{...current,...range}:null)}/>}
      {error&&<p className="research-error" role="alert">{error}</p>}
    </ConfirmDialog>
    </FloatingDrawerScope>
  </section></AppChrome>;
}
