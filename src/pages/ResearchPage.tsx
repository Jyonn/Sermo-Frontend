import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AppChrome } from '../components/AppChrome';
import { TabPageHeader } from '../components/TabPageHeader';
import { SideDrawer } from '../components/SideDrawer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SelectControl } from '../components/SettingRow';
import { Markdown } from '../components/ResearchMarkdown';
import { MarkdownInput } from '../components/ResearchMarkdownInput';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/language';
import { useSpaceFeatures } from '../lib/spaceFeatures';
import type { ResearchProject, ResearchSummary } from '../lib/research';
import type { UserDTO } from '../types';
import './ResearchPage.css';

export default function ResearchPage() {
  const {t}=useI18n(),{session}=useAuth(),features=useSpaceFeatures();
  const [list,setList]=useState<ResearchSummary[]>([]),[project,setProject]=useState<ResearchProject|null>(null),[id,setId]=useState<number|null>(null),[taskId,setTaskId]=useState<string|null>(null);
  const [panel,setPanel]=useState<'create'|'task'|'members'|null>(null),[friends,setFriends]=useState<UserDTO[]>([]),[scope,setScope]=useState('mine'),[tab,setTab]=useState('tasks');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tick,setTick]=useState(0),[reply,setReply]=useState<string|null>(null),[confirm,setConfirm]=useState<string|null>(null);
  const userId=session?.user.user_id;
  const owner=project?.members.some(m=>m.id===userId&&m.owner)===true;
  const writable=project?.status!=='completed';
  const task=project?.tasks.find(task=>task.id===taskId);
  useEffect(()=>{if(!features.ready||!features.researchEnabled)return;const controller=new AbortController();setLoading(true);setError('');setProject(null);api.researchList(controller.signal).then(setList).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[features.ready,features.researchEnabled,tick,userId]);
  useEffect(()=>{setProject(null);setTaskId(null);setReply(null);if(!id)return;const controller=new AbortController();setLoading(true);api.researchGet(id,controller.signal).then(p=>{if(!controller.signal.aborted)setProject(p);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[id,tick,userId]);
  useEffect(()=>{if(panel!=='members')return;const controller=new AbortController();setFriends([]);api.getFriends(controller.signal).then(setFriends).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[panel]);
  async function mutate(body:Record<string,unknown>){if(!project||busy)return;setBusy(true);setError('');try{const next=await api.researchUpdate(project.id,project.revision,body);if(['leave','dissolve'].includes(String(body.action))){setId(null);setProject(null);setTick(n=>n+1);}else setProject(next);return true;}catch(e){setError(e instanceof Error?e.message:t('research.failed'));return false;}finally{setBusy(false);}}
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);const body={title:String(data.get('title')||''),body:String(data.get('body')||''),description:String(data.get('description')||''),start:String(data.get('start')||''),end:String(data.get('end')||'')||null,assignees:data.getAll('member').map(Number)};
    if(panel==='create'){setBusy(true);setError('');try{const created=await api.researchCreate(body);setList(old=>[created,...old]);setId(created.id);setPanel(null);}catch(e){setError(e instanceof Error?e.message:t('research.failed'));}finally{setBusy(false);}}
    else if(await mutate({...body,action:'task'}))setPanel(null);
  }
  if(features.ready&&!features.researchEnabled)return <Navigate replace to="/app/menu"/>;
  const memberName=(value:number)=>project?.members.find(m=>m.id===value)?.name||`#${value}`;
  return <AppChrome title={t('research.title')} hideTopbar shellClassName="desktop-tab-shell"><section className="page-stack research-page">
    <TabPageHeader title={t('research.title')} actions={<button className="ghost-button" onClick={()=>setPanel('create')}>{t('research.create')}</button>}/>
    {error&&<div className="research-error" role="alert">{error}<button type="button" className="ghost-button" onClick={()=>setTick(n=>n+1)}>{t('common.retry')}</button></div>}
    <div className="research-project-bar"><SelectControl label={t('research.project')} value={String(id||'')} options={[{value:'',label:t('research.choose')},...list.map(p=>({value:String(p.id),label:p.title}))]} onChange={value=>{setId(value?Number(value):null);setTab('tasks');setError('');}}/>{project&&<><span>{project.start} → {project.end||t('research.openEnd')}</span><button className="ghost-button" onClick={()=>setPanel('members')} aria-label={t('research.members')}><span className="material-symbols-outlined">more_horiz</span></button></>}</div>
    {loading?<p className="research-empty" role="status">{t('common.loading')}</p>:!project?<div className="research-empty"><span className="material-symbols-outlined">science</span><h2>{t(list.length?'research.choose':'research.empty')}</h2><p>{t('research.intro')}</p><button className="primary-button" onClick={()=>setPanel('create')}>{t('research.create')}</button></div>:<>
      <div className="research-tabs" role="tablist">{(['tasks','calendar'] as const).map(key=><button role="tab" aria-selected={tab===key} key={key} onClick={()=>setTab(key)}>{t(key==='tasks'?'research.tasks':'research.calendar')}</button>)}</div>
      {tab==='calendar'?<div className="research-empty"><span className="material-symbols-outlined">event</span><h2>{t('research.calendarPending')}</h2><p>{t('research.calendarHint')}</p></div>:<div className={`research-task-layout ${task?'has-detail':''}`}>
        <aside><header><h2>{t('research.tasks')}</h2>{owner&&writable&&<button className="ghost-button" onClick={()=>setPanel('task')}>{t('research.addTask')}</button>}</header>{project.tasks.map(item=><button className={`research-task-row ${taskId===item.id?'selected':''}`} key={item.id} onClick={()=>{setTaskId(item.id);setReply(null);setScope('mine');}}><strong>{item.title}</strong><small>{item.assignees.map(memberName).join(' · ')}</small><small>{item.start} → {item.end||t('research.openEnd')}</small><span>{t(`research.${item.status}`)}</span></button>)}{!project.tasks.length&&<p className="research-muted">{t('research.noTasks')}</p>}</aside>
        <article className="research-task-detail">{task?<><header><button className="ghost-button research-back" onClick={()=>setTaskId(null)} aria-label={t('research.back')}><span className="material-symbols-outlined">arrow_back</span></button><span className="research-grow"/>{owner&&writable&&<SelectControl label={t('research.status')} disabled={busy} value={task.status} options={(['todo','doing','done'] as const).map(value=>({value,label:t(`research.${value}`)}))} onChange={status=>mutate({action:'task_status',task_id:task.id,status}).then(()=>{})}/>}</header><div className="research-detail-scroll"><h1>{task.title}</h1><p className="research-muted">{task.assignees.map(memberName).join(' · ')}<br/>{task.start} → {task.end||t('research.openEnd')}</p><Markdown body={task.body}/>
          <div className="research-progress-head"><h2>{t('research.progress')}</h2><SelectControl label={t('research.progress')} value={scope} onChange={setScope} options={[{value:'mine',label:t('research.mine')},{value:'all',label:t('research.all')}]}/></div><p className="research-muted">{t('research.shared')}</p>
          {task.progress.filter(p=>scope==='all'||p.user_id===userId).map(p=><section className="research-progress" key={p.id}><header><strong>{memberName(p.user_id)}</strong><time>{new Date(p.created_at).toLocaleString()}</time></header>{p.reply_to&&<blockquote><Markdown body={task.progress.find(parent=>parent.id===p.reply_to)?.body||''}/></blockquote>}<Markdown body={p.body}/>{writable&&<button className="ghost-button" onClick={()=>setReply(p.id)}>{t('research.reply')}</button>}{reply===p.id&&<ProgressEditor key={p.id} busy={busy} cancel={()=>setReply(null)} send={async body=>{if(await mutate({action:'progress',task_id:task.id,body,reply_to:reply}))setReply(null);}}/>}</section>)}
          {writable&&!reply&&<ProgressEditor key={`${task.id}-${userId}`} busy={busy} send={async body=>await mutate({action:'progress',task_id:task.id,body})===true}/>}
        </div></>:<div className="research-empty"><h2>{t('research.chooseTask')}</h2><p>{project.description}</p></div>}</article>
      </div>}
    </>}
    <SideDrawer open={panel!==null} onClose={()=>setPanel(null)} title={t(panel==='members'?'research.members':panel==='task'?'research.addTask':'research.create')}>
      {error&&<p className="research-error" role="alert">{error}</p>}{panel==='members'&&project?<div className="research-form"><h2>{project.title}</h2><p className="research-muted">{project.description}</p><p className="research-muted">{t('research.groupHint')}</p><Link className="ghost-button" to={`/app/chats/${project.chat_id}`}>{t('research.group')}</Link><SelectControl label={t('research.status')} disabled={!owner||busy} value={project.status} options={(['planning','active','completed'] as const).map(value=>({value,label:t(`research.${value}`)}))} onChange={status=>mutate({action:'settings',status}).then(()=>{})}/>
        {project.members.map(m=><div className="research-member" key={m.id}><span>{m.name}{m.owner?` · ${t('research.owner')}`:''}</span>{owner&&!m.owner&&<><button className="ghost-button" disabled={busy} onClick={()=>setConfirm(`transfer:${m.id}`)}>{t('research.transfer')}</button><button className="ghost-button" disabled={busy} onClick={()=>setConfirm(`remove:${m.id}`)}>{t('research.remove')}</button></>}</div>)}
        {owner&&writable&&<><h3>{t('research.invite')}</h3>{friends.filter(f=>!project.members.some(m=>m.id===f.user_id)).map(f=><button key={f.user_id} className="research-invite" disabled={busy} onClick={()=>mutate({action:'invite',user_id:f.user_id})}>{f.name}<span className="material-symbols-outlined">person_add</span></button>)}</>}
        <button className="ghost-button" disabled={busy} onClick={()=>setConfirm(owner?'dissolve':'leave')}>{t(owner?'research.dissolve':'research.leave')}</button>
      </div>:<form className="research-form" key={panel} onSubmit={submit}><label>{t('research.name')}<input name="title" maxLength={panel==='task'?160:50} required/></label><div className="research-period"><label>{t('research.start')}<input name="start" type="date" required/></label><label>{t('research.end')}<input name="end" type="date"/></label></div><p className="research-muted">{t('research.optionalEnd')}</p>{panel==='task'?<><fieldset><legend>{t('research.assignees')}</legend>{project?.members.map(m=><label className="research-check" key={m.id}><input type="checkbox" name="member" value={m.id}/>{m.name}</label>)}</fieldset><MarkdownField name="body" required/></>:<label>{t('research.description')}<textarea name="description" rows={4} maxLength={20000}/></label>}<button className="primary-button" disabled={busy}>{t('research.save')}</button></form>}
    </SideDrawer>
    <ConfirmDialog open={!!confirm} title={t('research.confirm')} description={t('research.sensitive')} danger onClose={()=>setConfirm(null)} onConfirm={()=>{const [action,user]=String(confirm).split(':');void mutate({action,...(user?{user_id:Number(user)}:{})}).then(ok=>{if(ok)setPanel(null);});setConfirm(null);}}/>
  </section></AppChrome>;
}

function MarkdownField({name,required=false,value,onChange}:{name:string;required?:boolean;value?:string;onChange?:(value:string)=>void}) {
  void name;
  return <MarkdownInput required={required} value={value} onChange={onChange}/>;
}
function ProgressEditor({send,cancel,busy}:{send:(body:string)=>Promise<boolean|void>;cancel?:()=>void;busy:boolean}) {
  const {t}=useI18n(),[body,setBody]=useState('');
  return <form className="research-progress-editor" onSubmit={async e=>{e.preventDefault();if(await send(body))setBody('');}}><MarkdownField name="body" value={body} onChange={setBody}/><footer>{cancel&&<button className="ghost-button" type="button" onClick={cancel}>{t('research.cancel')}</button>}<button className="primary-button" disabled={busy||!body.trim()}>{t('research.post')}</button></footer></form>;
}
