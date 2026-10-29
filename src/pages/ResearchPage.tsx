import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AppChrome } from '../components/AppChrome';
import { TabPageHeader } from '../components/TabPageHeader';
import { SideDrawer } from '../components/SideDrawer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SelectControl } from '../components/SettingRow';
import { Markdown } from '../components/ResearchMarkdown';
import { MarkdownInput } from '../components/ResearchMarkdownInput';
import { ResearchCalendar } from '../components/ResearchCalendar';
import { ResearchHome, ResearchOverview } from '../components/ResearchWorkspace';
import { PageTabs } from '../components/PageTabs';
import { FloatingDrawerScope } from '../components/DesktopPanelWorkspace';
import { HeaderIconButton } from '../components/HeaderIconButton';
import { ResearchCreateFlow, type ResearchDraft } from '../components/ResearchCreateFlow';
import { MarkdownEditorDialog } from '../components/MarkdownEditorDialog';
import { ResearchTaskItem } from '../components/ResearchTaskItem';
import { ResearchComments } from '../components/ResearchComments';
import { DateRangeField } from '../components/DateRangeField';
import { MemberPickerSheet } from '../components/MemberPickerSheet';
import { ResearchAssigneesField } from '../components/ResearchPeople';
import { ResearchProjectDetails } from '../components/ResearchProjectDetails';
import { ActionSheet } from '../components/ActionSheet';
import { QuietState } from '../components/BoundaryState';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/language';
import { useSpaceFeatures } from '../lib/spaceFeatures';
import { selectResearchProject } from '../lib/researchNavigation';
import type { ResearchProject, ResearchSummary } from '../lib/research';
import type { UserDTO } from '../types';
import './ResearchPage.css';
import './ResearchWorkspaceLayout.css';
const EmbeddedChats = lazy(() => import('./ChatsPage'));

export default function ResearchPage() {
  const {t}=useI18n(),{session}=useAuth(),features=useSpaceFeatures();
  const [search,setSearch]=useSearchParams();
  const returning=sessionStorage.getItem(`chronelle:return-project:${session?.user.user_id}`);
  const memoryKey=`research:current:${session?.user.user_id}`;
  const [list,setList]=useState<ResearchSummary[]>([]),[project,setProject]=useState<ResearchProject|null>(null),[id,setId]=useState<number|null>(()=>Number(search.get('project')||returning||localStorage.getItem(memoryKey))||null),[taskId,setTaskId]=useState<string|null>(null);
  const [chatOpen,setChatOpen]=useState(false),[onboarding,setOnboarding]=useState(!!returning||search.has('onboarding'));
  const [panel,setPanel]=useState<'create'|'manage'|'task'|'members'|'description'|null>(null),[friends,setFriends]=useState<UserDTO[]>([]),[scope,setScope]=useState('mine'),[tab,setTab]=useState(returning||search.has('onboarding')?'calendar':search.has('task')?'tasks':'overview');
  const [inviteOpen,setInviteOpen]=useState(false),[memberAction,setMemberAction]=useState<number|null>(null);
  const [memberPickerAction,setMemberPickerAction]=useState<'transfer'|'remove'|null>(null);
  const [listLoading,setListLoading]=useState(true),[loading,setLoading]=useState(!!id),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tick,setTick]=useState(0),[confirm,setConfirm]=useState<string|null>(null);
  const userId=session?.user.user_id;
  const owner=project?.members.some(m=>m.id===userId&&m.owner)===true;
  const writable=project?.status!=='archived';
  const task=project?.tasks.find(task=>task.id===taskId);
  const requestedProject=Number(search.get('project'))||null,requestedTask=search.get('task');
  useEffect(()=>{if(requestedProject)setId(requestedProject);if(requestedTask){setTaskId(requestedTask);setTab('tasks');}},[requestedProject,requestedTask]);
  const [dates,setDates]=useState<{taskId?:string;from:string;to:string}|null>(null);
  function openProject(value:number){setId(value);setTab('overview');setScope('mine');setOnboarding(false);setError('');setPanel(null);setChatOpen(false);}
  useEffect(()=>{if(listLoading)return;const next=selectResearchProject(list,id);if(next!==id){setId(next);setError('');}},[list,listLoading,id]);
  useEffect(()=>{if(id)localStorage.setItem(memoryKey,String(id));},[id,memoryKey]);
  useEffect(()=>{if(search.has('panel'))setSearch(params=>{const stack=(params.get('panel')||'').split('/').filter(part=>part!=='research-project');if(stack.length)params.set('panel',stack.join('/'));else params.delete('panel');return params;},{replace:true});},[]);
  useEffect(()=>{if(!id&&listLoading)return;const sync=()=>{const url=new URL(window.location.href);const next=id?String(id):null;if(url.searchParams.get('project')!==next){if(next)url.searchParams.set('project',next);else url.searchParams.delete('project');window.history.replaceState(window.history.state,'',url);}};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[id,listLoading,search]);
  useEffect(()=>{if(!features.ready||!features.researchEnabled)return;const controller=new AbortController();setListLoading(true);setError('');api.researchList(controller.signal).then(setList).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setListLoading(false);});return()=>controller.abort();},[features.ready,features.researchEnabled,tick,userId]);
  useEffect(()=>{setProject(null);setTaskId(null);if(!id){setLoading(false);return;}const controller=new AbortController();setLoading(true);api.researchGet(id,controller.signal).then(p=>{if(!controller.signal.aborted){setProject(p);setTaskId(p.tasks.find(item=>item.id===search.get('task'))?.id||p.tasks.find(item=>item.status==='active')?.id||p.tasks[0]?.id||null);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[id,tick,userId]);
  useEffect(()=>{if(panel!=='members')return;const controller=new AbortController();setFriends([]);api.getFriends(controller.signal).then(setFriends).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[panel]);
  async function mutate(body:Record<string,unknown>){if(!project||busy)return;setBusy(true);setError('');try{const next=await api.researchUpdate(project.id,project.revision,body);if(['leave','dissolve'].includes(String(body.action))){setList(items=>items.filter(item=>item.id!==project.id));setId(null);setProject(null);localStorage.removeItem(memoryKey);setTick(n=>n+1);}else {setProject(next);setList(items=>items.map(item=>item.id===next.id?next:item));if(body.action==='task'){const added=next.tasks.find(item=>!project.tasks.some(old=>old.id===item.id));if(added){setTaskId(added.id);setTab('tasks');}}}return true;}catch(e){setError(e instanceof Error?e.message:t('research.failed'));return false;}finally{setBusy(false);}}
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);const body={title:String(data.get('title')||''),body:String(data.get('body')||''),description:String(data.get('description')||''),start:String(data.get('start')||''),end:String(data.get('end')||'')||null,assignees:data.getAll('member').map(Number)};
    if(await mutate({...body,action:'task'}))setPanel(null);
  }
  async function createProject(body:ResearchDraft){
    if(busy)return false;setBusy(true);setError('');
    try{const created=await api.researchCreate(body);setList(old=>[created,...old]);setId(created.id);setTab('calendar');setOnboarding(true);setPanel(null);return true;}
    catch(e){setError(e instanceof Error?e.message:t('research.failed'));return false;}
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
    <TabPageHeader title={t('research.title')} actions={<><HeaderIconButton label={t('research.create')} onClick={()=>{setError('');setPanel('create');}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></HeaderIconButton>{project&&<HeaderIconButton label={t('research.members')} onClick={()=>setPanel('members')}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></HeaderIconButton>}</>} secondary={id&&list.length?<div className="research-current-project"><div><strong>{project?.title||list.find(item=>item.id===id)?.title}</strong>{project&&<span className={`research-status is-${project.status}`}>{t(`research.${project.status}`)}</span>}</div><SelectControl compact label={t('research.switchProject')} triggerLabel={<><span className="material-symbols-outlined" aria-hidden="true">swap_horiz</span>{t('research.switchProject')}</>} value={String(id)} options={[...list.map(p=>({value:String(p.id),label:`${p.title} · ${t(`research.${p.status}`)}`})),{value:'manage',label:t('research.manageProjects')}]} onChange={value=>{if(value==='manage')setPanel('manage');else openProject(Number(value));}}/></div>:undefined}/>
    {error&&<div className="research-error" role="alert">{error}<button type="button" className="ghost-button" onClick={()=>setTick(n=>n+1)}>{t('common.retry')}</button></div>}
    <FloatingDrawerScope><div className="research-project-surface">
    {listLoading||loading?<p className="research-empty" role="status">{t('common.loading')}</p>:!list.length?<ResearchHome projects={[]} open={openProject} create={()=>setPanel('create')}/>:!project?<QuietState icon="science" title={t('research.failed')}/>:<>
      <div className="research-project-navigation"><PageTabs label={t('research.project')} value={tab} onChange={setTab} items={(['overview','tasks','calendar'] as const).map(value=>({value,label:t(`research.${value}`)}))}/></div>
      {tab==='overview'?<ResearchOverview project={project} chat={()=>setChatOpen(true)} tasks={value=>{setTaskId(value||null);setTab('tasks');}} calendar={()=>setTab('calendar')} members={()=>setPanel('members')} addTask={()=>setPanel('task')} canEdit={owner&&writable}/>:tab==='calendar'?<ResearchCalendar key={`${project.id}-${userId}`} project={project} userId={userId!} onboarding={onboarding} onOnboarded={completeOnboarding}/>:<div className={`research-task-layout ${task?'has-detail':''}`}>
        <aside><header><span className="research-muted">{project.tasks.length} {t('research.tasks')}</span>{owner&&writable&&<HeaderIconButton label={t('research.addTask')} onClick={()=>setPanel('task')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></HeaderIconButton>}</header>{[...project.tasks].sort((a,b)=>Number(a.status==='archived')-Number(b.status==='archived')).map(item=><ResearchTaskItem key={item.id} task={item} members={project.members} selected={taskId===item.id} onClick={()=>{setTaskId(item.id);setScope('mine');}}/>)}{!project.tasks.length&&<QuietState icon="assignment" title={t('research.noTasks')} description={t('research.taskEmptyHint')}/>}</aside>
        <article className="research-task-detail">{task?<ResearchComments key={task.id} project={project} task={task} userId={userId!} scope={scope} writable={writable&&task.status!=='archived'} busy={busy} send={async (body,reply_to)=>await mutate({action:'progress',task_id:task.id,body,reply_to})===true}>
          <header className="research-task-heading"><button className="ghost-button research-back" onClick={()=>setTaskId(null)} aria-label={t('research.back')}><span className="material-symbols-outlined">arrow_back</span></button><h1>{task.title}</h1>{owner&&writable?<SelectControl compact label={t('research.status')} disabled={busy} value={task.status} options={(['active','archived'] as const).map(value=>({value,label:t(`research.${value}`)}))} onChange={status=>mutate({action:'task_status',task_id:task.id,status}).then(()=>{})}/>:<span className={`research-status is-${task.status}`}>{t(`research.${task.status}`)}</span>}</header>
          <div className="research-task-meta"><span><span className="material-symbols-outlined" aria-hidden="true">group</span>{task.assignees.map(memberName).join(' · ')||t('research.unassigned')}</span><button type="button" className="research-task-dates" disabled={!owner||!writable||busy} aria-label={t('research.editDates')} onClick={()=>setDates({taskId:task.id,from:task.start,to:task.end||''})}><span className="material-symbols-outlined" aria-hidden="true">date_range</span>{task.start} — {task.end||t('research.openEnd')}{owner&&writable&&<span className="material-symbols-outlined" aria-hidden="true">edit</span>}</button></div><div className="research-task-body"><Markdown body={task.body}/></div>
          <div className="research-progress-head"><h2 title={t('research.shared')}>{t('research.progress')}</h2><SelectControl compact label={t('research.progressFilter')} value={scope} onChange={setScope} options={[{value:'mine',label:t('research.mine')},{value:'all',label:t('research.all')}]}/></div>
        </ResearchComments>:<QuietState icon="assignment" title={t('research.chooseTask')} description={t('research.taskEmptyHint')}/>}</article>
      </div>}
    </>}
    </div></FloatingDrawerScope>
    <FloatingDrawerScope>
    <SideDrawer historyKey="research-manage" open={panel==='manage'} onClose={()=>setPanel(null)} title={t('research.manageProjects')} headerAction={<HeaderIconButton label={t('research.create')} onClick={()=>setPanel('create')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></HeaderIconButton>}><ResearchHome projects={list} selected={id} open={openProject} create={()=>setPanel('create')}/></SideDrawer>
    <SideDrawer historyKey="research-chat" className="research-chat-drawer" headerless floatingBack={false} fullscreen open={chatOpen&&!!project} onClose={()=>setChatOpen(false)} title={t('research.group')}>
      {chatOpen&&project&&<Suspense fallback={<QuietState title={t('common.loading')}/>}><EmbeddedChats embeddedChat={{id:project.chat_id,onClose:()=>setChatOpen(false)}}/></Suspense>}
    </SideDrawer>
    <SideDrawer historyKey={panel==='task'?'research-task-create':'research-members'} open={panel==='task'||panel==='members'} fullscreen={panel==='task'} onClose={()=>setPanel(null)} title={t(panel==='members'?'research.members':'research.addTask')}>
      {error&&<p className="research-error" role="alert">{error}</p>}
      {panel==='members'&&project?<ResearchProjectDetails project={project} owner={owner} busy={busy}
        onDates={()=>setDates({from:project.start,to:project.end||''})}
        onDescription={()=>setPanel('description')} onMember={member=>setMemberAction(member.id)} onAdd={()=>setInviteOpen(true)}
        onRemove={()=>setMemberPickerAction('remove')} onTransfer={()=>setMemberPickerAction('transfer')}
        onChat={()=>{setPanel(null);setChatOpen(true);}} onDanger={()=>setConfirm(owner?'dissolve':'leave')}
        onStatus={async status=>{if(!await mutate({action:'settings',status}))throw new Error('Status update failed');}}/>
        :<form className="research-form" key={panel} onSubmit={submit}><><label>{t('research.name')}<input name="title" maxLength={160} required/></label><DateRangeField/><ResearchAssigneesField members={project?.members||[]}/><MarkdownField name="body" required/></><button className="button" disabled={busy}>{t('research.save')}</button></form>}
    </SideDrawer>
    {memberPickerAction&&project&&<MemberPickerSheet title={t(memberPickerAction==='transfer'?'research.transferOwner':'research.remove')} members={project.members.filter(member=>!member.owner)} initial={[]} limit={1} allowEmpty={false} actionLabel={t('common.next')} onClose={()=>setMemberPickerAction(null)} onApply={ids=>{setConfirm(`${memberPickerAction}:${ids[0]}`);}}/>}
    {inviteOpen&&project&&<MemberPickerSheet allowEmpty={false} title={t('research.invite')} initial={[]} actionLabel={t('research.sendInvitation')} error={error} members={inviteCandidates} onClose={()=>setInviteOpen(false)} onApply={inviteMembers}/>}
    <ActionSheet open={memberAction!==null} title={memberName(memberAction||0)} onClose={()=>setMemberAction(null)} actions={[{key:'transfer',label:t('research.transfer'),disabled:busy,onSelect:()=>setConfirm(`transfer:${memberAction}`)},{key:'remove',label:t('research.remove'),danger:true,disabled:busy,onSelect:()=>setConfirm(`remove:${memberAction}`)}]}/>
    <ConfirmDialog open={!!confirm} title={t('research.confirm')} description={t('research.sensitive')} danger onClose={()=>setConfirm(null)} onConfirm={()=>{const [action,user]=String(confirm).split(':');void mutate({action,...(user?{user_id:Number(user)}:{})}).then(ok=>{if(ok)setPanel(null);});setConfirm(null);}}/>
    {panel==='description'&&project&&<MarkdownEditorDialog title={t('research.description')} initialValue={project.description} busy={busy} error={error} onClose={()=>setPanel(null)} onSave={value=>{void mutate({action:'settings',description:value}).then(ok=>{if(ok)setPanel(null);});}}/>}
    {panel==='create'&&<ResearchCreateFlow busy={busy} error={error} onClose={()=>setPanel(null)} onCreate={createProject}/>}
    <ConfirmDialog open={!!dates} title={t('research.editDates')} description="" busy={busy} confirmLabel={t('research.save')} onClose={()=>setDates(null)} onConfirm={()=>{if(dates)void mutate({action:dates.taskId?'task_dates':'settings',...(dates.taskId?{task_id:dates.taskId}:{}),start:dates.from,end:dates.to||null}).then(ok=>{if(ok)setDates(null);});}}>
      {dates&&<DateRangeField value={dates} onChange={range=>setDates(current=>current?{...current,...range}:null)}/>}
      {error&&<p className="research-error" role="alert">{error}</p>}
    </ConfirmDialog>
    </FloatingDrawerScope>
  </section></AppChrome>;
}

function MarkdownField({name,required=false,value,onChange}:{name:string;required?:boolean;value?:string;onChange?:(value:string)=>void}) {
  void name;
  return <MarkdownInput required={required} value={value} onChange={onChange}/>;
}
