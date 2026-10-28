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
import { DrawerTabs } from '../components/DrawerTabs';
import { DateRangeField } from '../components/DateRangeField';
import { MemberPickerSheet } from '../components/MemberPickerSheet';
import { ResearchAssigneesField } from '../components/ResearchPeople';
import { ResearchProjectDetails } from '../components/ResearchProjectDetails';
import { UserAvatar } from '../components/UserAvatar';
import { ActionSheet } from '../components/ActionSheet';
import { QuietState } from '../components/BoundaryState';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/language';
import { useSpaceFeatures } from '../lib/spaceFeatures';
import type { ResearchProject, ResearchSummary } from '../lib/research';
import type { UserDTO } from '../types';
import './ResearchPage.css';
const EmbeddedChats = lazy(() => import('./ChatsPage'));

export default function ResearchPage() {
  const {t}=useI18n(),{session}=useAuth(),features=useSpaceFeatures();
  const [search,setSearch]=useSearchParams();
  const returning=sessionStorage.getItem(`chronelle:return-project:${session?.user.user_id}`);
  const [list,setList]=useState<ResearchSummary[]>([]),[project,setProject]=useState<ResearchProject|null>(null),[id,setId]=useState<number|null>(()=>Number(search.get('project')||returning)||null),[taskId,setTaskId]=useState<string|null>(null);
  const [chatOpen,setChatOpen]=useState(false),[onboarding,setOnboarding]=useState(!!returning||search.has('onboarding'));
  const [panel,setPanel]=useState<'create'|'task'|'members'|null>(null),[friends,setFriends]=useState<UserDTO[]>([]),[scope,setScope]=useState('mine'),[tab,setTab]=useState(returning||search.has('onboarding')?'calendar':'overview');
  const [taskFilter,setTaskFilter]=useState('all');
  const [inviteOpen,setInviteOpen]=useState(false),[memberAction,setMemberAction]=useState<number|null>(null);
  const [memberPickerAction,setMemberPickerAction]=useState<'transfer'|'remove'|null>(null);
  const [listLoading,setListLoading]=useState(true),[loading,setLoading]=useState(!!id),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tick,setTick]=useState(0),[reply,setReply]=useState<string|null>(null),[confirm,setConfirm]=useState<string|null>(null);
  const userId=session?.user.user_id;
  const owner=project?.members.some(m=>m.id===userId&&m.owner)===true;
  const writable=project?.status!=='completed';
  const task=project?.tasks.find(task=>task.id===taskId);
  useEffect(()=>{if(!id)return;const url=new URL(window.location.href);if(url.searchParams.get('project')!==String(id)){url.searchParams.set('project',String(id));window.history.replaceState(window.history.state,'',url);window.dispatchEvent(new PopStateEvent('popstate',{state:window.history.state}));}},[id]);
  useEffect(()=>{if(!features.ready||!features.researchEnabled)return;const controller=new AbortController();setListLoading(true);setError('');api.researchList(controller.signal).then(setList).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setListLoading(false);});return()=>controller.abort();},[features.ready,features.researchEnabled,tick,userId]);
  useEffect(()=>{setProject(null);setTaskId(null);setReply(null);if(!id)return;const controller=new AbortController();setLoading(true);api.researchGet(id,controller.signal).then(p=>{if(!controller.signal.aborted)setProject(p);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[id,tick,userId]);
  useEffect(()=>{if(panel!=='members')return;const controller=new AbortController();setFriends([]);api.getFriends(controller.signal).then(setFriends).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[panel]);
  async function mutate(body:Record<string,unknown>){if(!project||busy)return;setBusy(true);setError('');try{const next=await api.researchUpdate(project.id,project.revision,body);if(['leave','dissolve'].includes(String(body.action))){setId(null);setProject(null);setTick(n=>n+1);}else {setProject(next);setList(items=>items.map(item=>item.id===next.id?next:item));if(body.action==='task'){const added=next.tasks.find(item=>!project.tasks.some(old=>old.id===item.id));if(added){setTaskId(added.id);setTaskFilter('all');setTab('tasks');}}}return true;}catch(e){setError(e instanceof Error?e.message:t('research.failed'));return false;}finally{setBusy(false);}}
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);const body={title:String(data.get('title')||''),body:String(data.get('body')||''),description:String(data.get('description')||''),start:String(data.get('start')||''),end:String(data.get('end')||'')||null,assignees:data.getAll('member').map(Number)};
    if(panel==='create'){setBusy(true);setError('');try{const created=await api.researchCreate(body);setList(old=>[created,...old]);setId(created.id);setTab('calendar');setOnboarding(true);setPanel(null);}catch(e){setError(e instanceof Error?e.message:t('research.failed'));}finally{setBusy(false);}}
    else if(await mutate({...body,action:'task'}))setPanel(null);
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
  if(features.ready&&!features.researchEnabled)return <Navigate replace to="/app/menu"/>;
  const memberName=(value:number)=>project?.members.find(m=>m.id===value)?.name||`#${value}`;
  const inviteCandidates=project?[...project.members.map(member=>({...member,locked:true})),...friends.filter(friend=>!project.members.some(member=>member.id===friend.user_id)).map(friend=>({id:friend.user_id,name:friend.name,avatar_uri:friend.avatar_uri,avatar_cache_key:friend.avatar_cache_key,avatar_frame_style:friend.avatar_frame_style,locked:project.pending_invitee_ids?.includes(friend.user_id),lockedLabel:t('research.invited'),description:t(friend.is_alive?'presence.online':'presence.offline')}))]:[];
  return <AppChrome workspaceSelected={!!id} title={t('research.title')} hideTopbar shellClassName="desktop-tab-shell"><section className="page-stack research-page">
    <TabPageHeader title={t('research.title')} actions={<button className="ghost-button" onClick={()=>setPanel('create')}><span className="material-symbols-outlined" aria-hidden="true">add</span>{t('research.create')}</button>}/>
    {error&&<div className="research-error" role="alert">{error}<button type="button" className="ghost-button" onClick={()=>setTick(n=>n+1)}>{t('common.retry')}</button></div>}
    {listLoading?<p className="research-empty" role="status">{t('common.loading')}</p>:<ResearchHome projects={list} selected={id} open={value=>{setId(value);setTab('overview');setError('');}} create={()=>setPanel('create')}/>}
    <SideDrawer historyKey="research-project" className="research-project-drawer" fullscreen open={!!id} title={project?.title||t('research.project')} titleAccessory={project?<span className={`research-status is-${project.status}`}>{t(`research.${project.status}`)}</span>:undefined} headerAction={<button className="ghost-button" disabled={!project} onClick={()=>setPanel('members')} aria-label={t('research.members')}><span className="material-symbols-outlined">more_horiz</span></button>} onClose={()=>{setId(null);setTab('overview');setOnboarding(false);sessionStorage.removeItem(`chronelle:return-project:${userId}`);setSearch(params=>{params.delete('project');params.delete('onboarding');return params;},{replace:true});}}>
    <div className="research-project-surface">
    {loading?<p className="research-empty" role="status">{t('common.loading')}</p>:!project?<QuietState icon="science" title={t('research.failed')}/>:<>
      <div className="research-project-navigation"><PageTabs label={t('research.project')} value={tab} onChange={setTab} items={(['overview','tasks','calendar'] as const).map(value=>({value,label:t(`research.${value}`)}))} trailing={<SelectControl compact label={t('research.project')} value={String(id)} options={list.map(p=>({value:String(p.id),label:p.title}))} onChange={value=>{setId(Number(value));setError('');}}/>}/></div>
      {tab==='overview'?<ResearchOverview project={project} chat={()=>setChatOpen(true)} tasks={value=>{setTaskId(value||null);setTab('tasks');setTaskFilter('all');}} calendar={()=>setTab('calendar')} members={()=>setPanel('members')} addTask={()=>setPanel('task')} canEdit={owner&&writable}/>:tab==='calendar'?<ResearchCalendar key={`${project.id}-${userId}`} project={project} userId={userId!} onboarding={onboarding} onOnboarded={()=>setOnboarding(false)}/>:<div className={`research-task-layout ${task?'has-detail':''}`}>
        <aside><header><span className="research-muted">{project.tasks.length} {t('research.tasks')}</span>{owner&&writable&&<button className="ghost-button" onClick={()=>setPanel('task')} aria-label={t('research.addTask')}><span className="material-symbols-outlined">add</span></button>}</header><div className="research-task-filters"><DrawerTabs label={t('research.status')} value={taskFilter} onChange={setTaskFilter} items={(['allItems','todo','doing','done'] as const).map(key=>({value:key==='allItems'?'all':key,label:t(`research.${key}`)}))}/></div>{project.tasks.filter(item=>taskFilter==='all'||item.status===taskFilter).map(item=><button className={`research-task-row ${taskId===item.id?'selected':''}`} aria-current={taskId===item.id?'true':undefined} key={item.id} onClick={()=>{setTaskId(item.id);setReply(null);setScope('mine');}}><span className={`research-task-dot is-${item.status}`} aria-hidden="true"/><span className="research-task-row-copy"><strong>{item.title}</strong><small>{item.assignees.map(memberName).join(' · ')||t('research.unassigned')}</small><small>{item.end||t('research.openEnd')}</small></span><span className={`research-status is-${item.status}`}>{t(`research.${item.status}`)}</span></button>)}{!project.tasks.filter(item=>taskFilter==='all'||item.status===taskFilter).length&&<QuietState icon="assignment" title={t('research.noTasks')} description={t('research.taskEmptyHint')}/>}</aside>
        <article className="research-task-detail">{task?<><header><button className="ghost-button research-back" onClick={()=>setTaskId(null)} aria-label={t('research.back')}><span className="material-symbols-outlined">arrow_back</span>{t('research.tasks')}</button><span className="research-grow"/><span className={`research-status is-${task.status}`}>{t(`research.${task.status}`)}</span>{owner&&writable&&<SelectControl compact label={t('research.status')} disabled={busy} value={task.status} options={(['todo','doing','done'] as const).map(value=>({value,label:t(`research.${value}`)}))} onChange={status=>mutate({action:'task_status',task_id:task.id,status}).then(()=>{})}/>}</header><div className="research-detail-scroll"><h1>{task.title}</h1><div className="research-task-meta"><span><span className="material-symbols-outlined" aria-hidden="true">group</span>{task.assignees.map(memberName).join(' · ')||t('research.unassigned')}</span><span><span className="material-symbols-outlined" aria-hidden="true">date_range</span>{task.start} — {task.end||t('research.openEnd')}</span></div><div className="research-task-body"><Markdown body={task.body}/></div>
          <div className="research-progress-head"><h2>{t('research.progress')}</h2><SelectControl compact label={t('research.progress')} value={scope} onChange={setScope} options={[{value:'mine',label:t('research.mine')},{value:'all',label:t('research.all')}]}/></div><p className="research-muted">{t('research.shared')}</p>
          {writable&&!reply&&<ProgressEditor key={`${task.id}-${userId}`} busy={busy} send={async body=>await mutate({action:'progress',task_id:task.id,body})===true}/>}
          {[...task.progress].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).filter(p=>scope==='all'||p.user_id===userId).map(p=><section className="research-progress" key={p.id}><header><UserAvatar className="research-progress-avatar" name={memberName(p.user_id)} uri={project.members.find(member=>member.id===p.user_id)?.avatar_uri} cacheKey={project.members.find(member=>member.id===p.user_id)?.avatar_cache_key} frame={project.members.find(member=>member.id===p.user_id)?.avatar_frame_style}/><strong>{memberName(p.user_id)}</strong><time>{new Date(p.created_at).toLocaleString()}</time></header><div className="research-progress-content">{p.reply_to&&<blockquote><Markdown body={task.progress.find(parent=>parent.id===p.reply_to)?.body||''}/></blockquote>}<Markdown body={p.body}/>{writable&&<button className="ghost-button" onClick={()=>setReply(p.id)}>{t('research.reply')}</button>}{reply===p.id&&<ProgressEditor key={p.id} busy={busy} cancel={()=>setReply(null)} send={async body=>{if(await mutate({action:'progress',task_id:task.id,body,reply_to:reply}))setReply(null);}}/>}</div></section>)}
          {!task.progress.some(p=>scope==='all'||p.user_id===userId)&&<QuietState icon="edit_note" title={t('research.noProgress')} description={t('research.progressEmptyHint')}/>}
        </div></>:<QuietState icon="assignment" title={t('research.chooseTask')} description={t('research.taskEmptyHint')}/>}</article>
      </div>}
    </>}
    </div></SideDrawer>
    <SideDrawer historyKey="research-chat" className="research-chat-drawer" headerless floatingBack={false} fullscreen open={chatOpen&&!!project} onClose={()=>setChatOpen(false)} title={t('research.group')}>
      {chatOpen&&project&&<Suspense fallback={<QuietState title={t('common.loading')}/>}><EmbeddedChats embeddedChat={{id:project.chat_id,onClose:()=>setChatOpen(false)}}/></Suspense>}
    </SideDrawer>
    <SideDrawer historyKey={panel==='create'?'research-create':panel==='task'?'research-task-create':'research-members'} open={panel!==null} fullscreen={panel==='task'} onClose={()=>setPanel(null)} title={t(panel==='members'?'research.members':panel==='task'?'research.addTask':'research.create')}>
      {error&&<p className="research-error" role="alert">{error}</p>}
      {panel==='members'&&project?<ResearchProjectDetails project={project} owner={owner} busy={busy}
        onMember={member=>setMemberAction(member.id)} onAdd={()=>setInviteOpen(true)}
        onRemove={()=>setMemberPickerAction('remove')} onTransfer={()=>setMemberPickerAction('transfer')}
        onChat={()=>{setPanel(null);setChatOpen(true);}} onDanger={()=>setConfirm(owner?'dissolve':'leave')}
        onStatus={async status=>{if(!await mutate({action:'settings',status}))throw new Error('Status update failed');}}/>
        :<form className="research-form" key={panel} onSubmit={submit}><label>{t('research.name')}<input name="title" maxLength={panel==='task'?160:50} required/></label><DateRangeField/>{panel==='task'?<><ResearchAssigneesField members={project?.members||[]}/><MarkdownField name="body" required/></>:<label>{t('research.description')}<textarea name="description" rows={4} maxLength={20000}/></label>}<button className="button" disabled={busy}>{t('research.save')}</button></form>}
    </SideDrawer>
    {memberPickerAction&&project&&<MemberPickerSheet title={t(memberPickerAction==='transfer'?'research.transferOwner':'research.remove')} members={project.members.filter(member=>!member.owner)} initial={[]} limit={1} allowEmpty={false} actionLabel={t('common.next')} onClose={()=>setMemberPickerAction(null)} onApply={ids=>{setConfirm(`${memberPickerAction}:${ids[0]}`);}}/>}
    {inviteOpen&&project&&<MemberPickerSheet allowEmpty={false} title={t('research.invite')} initial={[]} actionLabel={t('research.sendInvitation')} error={error} members={inviteCandidates} onClose={()=>setInviteOpen(false)} onApply={inviteMembers}/>}
    <ActionSheet open={memberAction!==null} title={memberName(memberAction||0)} onClose={()=>setMemberAction(null)} actions={[{key:'transfer',label:t('research.transfer'),disabled:busy,onSelect:()=>setConfirm(`transfer:${memberAction}`)},{key:'remove',label:t('research.remove'),danger:true,disabled:busy,onSelect:()=>setConfirm(`remove:${memberAction}`)}]}/>
    <ConfirmDialog open={!!confirm} title={t('research.confirm')} description={t('research.sensitive')} danger onClose={()=>setConfirm(null)} onConfirm={()=>{const [action,user]=String(confirm).split(':');void mutate({action,...(user?{user_id:Number(user)}:{})}).then(ok=>{if(ok)setPanel(null);});setConfirm(null);}}/>
  </section></AppChrome>;
}

function MarkdownField({name,required=false,value,onChange}:{name:string;required?:boolean;value?:string;onChange?:(value:string)=>void}) {
  void name;
  return <MarkdownInput required={required} value={value} onChange={onChange}/>;
}
function ProgressEditor({send,cancel,busy}:{send:(body:string)=>Promise<boolean|void>;cancel?:()=>void;busy:boolean}) {
  const {t}=useI18n(),[body,setBody]=useState('');
  return <form className="research-progress-editor" onSubmit={async e=>{e.preventDefault();if(await send(body))setBody('');}}><MarkdownField name="body" value={body} onChange={setBody}/><footer>{cancel&&<button className="ghost-button" type="button" onClick={cancel}>{t('research.cancel')}</button>}<button className="button" disabled={busy||!body.trim()}>{t('research.post')}</button></footer></form>;
}
