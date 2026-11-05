import { useEffect, useRef, useState, type ReactNode } from 'react';
import {SelectControl} from './SettingRow';
import { CommentThread } from './CommentThread';
import { CommentComposer } from './CommentComposer';
import { Markdown } from './ResearchMarkdown';
import { MarkdownInput } from './ResearchMarkdownInput';
import { MarkdownEditorDialog } from './MarkdownEditorDialog';
import { useMobileMarkdownMode } from '../lib/useMobileMarkdownEditor';
import { QuietState } from './BoundaryState';
import { UserAvatar } from './UserAvatar';
import { UserProfilePanel } from './UserProfilePanel';
import { SideDrawer } from './SideDrawer';
import { useI18n, type TranslationKey } from '../lib/language';
import type { ResearchProject, ResearchTask } from '../lib/research';
import type { SquareStatementCommentDTO, TinyUserDTO } from '../types';
import './ResearchComments.css';
import {ResearchAwardForm} from './ResearchAwardForm';
import type {ResearchMutation} from './ResearchWorkflow';

export function ResearchComments({project,task,userId,scope,writable,busy,send,children,mutate,focusProgressId}:{
  project:ResearchProject;task:ResearchTask;userId:number;scope:string;writable:boolean;busy:boolean;
  send:(body:string,replyTo?:string,responseTo?:number)=>Promise<boolean>;
  mutate:ResearchMutation;
  children?:ReactNode;focusProgressId?:string;
}) {
  const {t,language}=useI18n();
  const [selectedDay,setSelectedDay]=useState('all');
  const [body,setBody]=useState(''),[reply,setReply]=useState<string|null>(null);
  const [editing,setEditing]=useState(false),[sendError,setSendError]=useState('');
  const mobile=useMobileMarkdownMode();
  const [requiresAnswer,setRequiresAnswer]=useState(false),[answerTarget,setAnswerTarget]=useState('');
  const [awarding,setAwarding]=useState<{userId:number;sourceId:string;awardId?:string}|null>(null);
  const isMentor=project.members.some(m=>m.id===userId&&m.owner);
  const targets=project.members.filter(m=>m.id!==userId&&(isMentor?!m.owner:m.owner));
  const draftBeforeEdit=useRef('');
  const [expanded,setExpanded]=useState<number|null>(null),[profile,setProfile]=useState<TinyUserDTO|null>(null);
  const commentIds=useRef(new Map<string,number>());
  for(const item of task.progress)if(!commentIds.current.has(item.id))commentIds.current.set(item.id,commentIds.current.size+1);
  const commentId=(id:string)=>commentIds.current.get(id)!;
  const record=(id:number)=>task.progress.find(item=>commentId(item.id)===id)!;
  const editor=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(editing&&!mobile)editor.current?.querySelector('textarea')?.focus({preventScroll:true});},[editing,mobile]);
  useEffect(()=>{
    if(!editing||mobile)return;
    let frame=0;
    const inside=(target:EventTarget|null)=>target instanceof Element&&(editor.current?.contains(target)||Boolean(target.closest('.v3-heading-menu,.v3-table-picker')));
    const collapse=()=>{if(!busy)setEditing(false);};
    const pointer=(event:PointerEvent)=>{if(!inside(event.target))collapse();};
    const blur=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!inside(document.activeElement))collapse();});};
    document.addEventListener('pointerdown',pointer);editor.current?.addEventListener('focusout',blur);window.addEventListener('blur',collapse);
    const root=editor.current;
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('pointerdown',pointer);root?.removeEventListener('focusout',blur);window.removeEventListener('blur',collapse);};
  },[editing,mobile,busy]);
  const user=(id:number):TinyUserDTO=>{
    const member=project.members.find(item=>item.id===id);
    return {user_id:id,name:member?.name||String(id),avatar_uri:member?.avatar_uri,avatar_cache_key:member?.avatar_cache_key,avatar_frame_style:member?.avatar_frame_style};
  };
  const items=[...task.progress].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  const dayOf=(value:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(value));
  const days=[...new Set(items.map(item=>dayOf(item.created_at)))].sort().reverse();
  const byId=new Map(items.map(item=>[item.id,item]));
  const rootOf=(id:string)=>{
    let current=byId.get(id);const visited=new Set<string>();
    while(current?.reply_to&&!visited.has(current.id)&&byId.has(current.reply_to)){visited.add(current.id);current=byId.get(current.reply_to);}
    return current?.id||id;
  };
  useEffect(()=>{if(!focusProgressId||!byId.has(focusProgressId))return;setSelectedDay('all');setExpanded(commentId(rootOf(focusProgressId)));const frame=requestAnimationFrame(()=>document.getElementById('research-progress-'+focusProgressId)?.scrollIntoView({block:'center',behavior:'smooth'}));return()=>cancelAnimationFrame(frame);},[focusProgressId,task.id,expanded]);
  useEffect(()=>{setSelectedDay('all');const response=task.progress.find(p=>p.reply_to);if(response)setExpanded(commentId(rootOf(response.id)));},[task.id]);
  const dto=(item:ResearchTask['progress'][number]):SquareStatementCommentDTO=>({
    comment_id:commentId(item.id),statement_id:0,user:user(item.user_id),text:item.body,
    created_at:Date.parse(item.created_at)/1000,like_count:0,reply_count:0,liked:false,can_delete:false,
    parent_id:item.reply_to?commentId(rootOf(item.id)):null,
    reply_to_user:item.reply_to?user(byId.get(item.reply_to)?.user_id||item.user_id):null,
  });
  const comments=items.filter(item=>!item.reply_to||!byId.has(item.reply_to)).map(item=>{
    const replies=items.filter(entry=>entry.id!==item.id&&rootOf(entry.id)===item.id&&(selectedDay==='all'||dayOf(entry.created_at)===selectedDay));
    return {...dto(item),replies:replies.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)).map(dto),reply_count:replies.length};
  }).filter(comment=>selectedDay==='all'||dayOf(record(comment.comment_id).created_at)===selectedDay||comment.replies.length>0).filter(comment=>scope==='all'||comment.user.user_id===userId||comment.replies.some(entry=>entry.user.user_id===userId));
  const target=reply?byId.get(reply):undefined;
  const me=user(userId);
  function beginEditing(){draftBeforeEdit.current=body;setSendError('');setEditing(true);}
  function cancelEditing(){setBody(draftBeforeEdit.current);setEditing(false);setSendError('');}
  async function submit(value:string){
    if(busy||!value.trim())return;
    setSendError('');
    if(await send(value,reply||undefined,requiresAnswer?Number(answerTarget||targets[0]?.id):undefined)){setBody('');setExpanded(reply?commentId(rootOf(reply)):expanded);setReply(null);setEditing(false);setRequiresAnswer(false);}
    else setSendError(t('research.failed'));
  }
  return <section className={`research-task-comments${editing&&!mobile?' is-composing':''}`}>
    <div className="research-comments-scroll">
      {children}
      <nav className="research-discussion-dates" aria-label={t('researchFlow.discussionDate')}><button type="button" aria-pressed={selectedDay==='all'} onClick={()=>setSelectedDay('all')}>{t('research.all')}</button>{days.map(day=><button type="button" key={day} aria-pressed={selectedDay===day} onClick={()=>setSelectedDay(day)}><strong>{new Intl.DateTimeFormat(language,{month:'short',day:'numeric'}).format(new Date(day+'T12:00:00'))}</strong><small>{new Intl.DateTimeFormat(language,{weekday:'short'}).format(new Date(day+'T12:00:00'))}</small></button>)}</nav>
      <div className="square-comment-list">{comments.map(comment=><CommentThread key={record(comment.comment_id).id} comment={comment} canInteract={writable} authorAccessory={entry=>(project.workflow?.comment_awards||[]).some(award=>award.source_id===record(entry.comment_id).id)?<span className="research-bonus-tag">BONUS</span>:null} expanded={expanded===comment.comment_id} onToggleReplies={id=>setExpanded(current=>current===id?null:id)} onDelete={()=>{}} onOpenProfile={setProfile} onReply={entry=>{setReply(record(entry.comment_id).id);const candidate=entry.user.user_id===userId?byId.get(rootOf(record(entry.comment_id).id))?.user_id:entry.user.user_id;setAnswerTarget(String(targets.find(m=>m.id===candidate)?.id||targets[0]?.id||''));setExpanded(entry.parent_id||entry.comment_id);beginEditing();}} renderContent={(entry,onReply)=>{const item=record(entry.comment_id);const bonuses=(project.workflow?.comment_awards||[]).filter(award=>award.source_id===item.id);return <div id={'research-progress-'+item.id} className={`research-comment-anchor${focusProgressId===item.id?' is-highlighted':''}${item.report_kind?' is-report':''}`}><div className="research-flow-metadata">{item.report_kind&&<><strong>{t(`researchFlow.${item.report_kind}` as TranslationKey)}</strong><small>{item.period_start}</small>{item.report_kind==='daily'&&<small>{t('researchFlow.aiTime')} {(item.ai_slots||0)/2}h · {t('researchFlow.thinkingTime')} {(item.thinking_slots||0)/2}h</small>}{item.waive_reward&&<small>{t('researchFlow.waived')}</small>}</>}{item.response_to&&<><strong className={`research-answer-status ${item.resolved_at?'is-resolved':'is-pending'}`}>{t(item.resolved_at?'researchFlow.answered':'researchFlow.response')} · {user(item.response_to).name}</strong>{!item.resolved_at&&[item.user_id,item.response_to].includes(userId)&&<button type="button" className="research-comment-action" disabled={busy} onClick={event=>{event.stopPropagation();void mutate({action:'resolve_request',id:item.id});}}>{t('researchFlow.resolve')}</button>}</>}{isMentor&&writable&&item.user_id!==userId&&<button type="button" className="research-comment-action" disabled={busy} onClick={event=>{event.stopPropagation();setAwarding({userId:item.user_id,sourceId:item.id,awardId:bonuses[0]?.id});}}>{t(bonuses.length?'researchFlow.editBonus':'researchFlow.award')}</button>}</div><div onClick={onReply}><Markdown body={entry.text}/></div>{bonuses.length>0&&<div className="research-comment-bonuses"><div>{bonuses.map(bonus=><div key={bonus.id}><strong>+{bonus.amount} {project.workflow?.reward_types.find(r=>r.id===bonus.reward_type)?.name||t(`researchFlow.${bonus.reward_type}` as TranslationKey)}</strong><span>{bonus.reason}</span>{isMentor&&writable&&<button type="button" className="research-comment-action" onClick={event=>{event.stopPropagation();setAwarding({userId:item.user_id,sourceId:item.id,awardId:bonus.id});}}>{t('researchFlow.edit')}</button>}</div>)}</div></div>}</div>;}}/>)}</div>
      {!comments.length&&<QuietState icon="forum" title={t('research.noProgress')} description={t('research.progressEmptyHint')}/>}
    </div>
    {writable&&<CommentComposer onSubmit={event=>{event.preventDefault();void submit(body);}}>
      <UserAvatar className="square-comment-avatar" name={me.name} uri={me.avatar_uri} cacheKey={me.avatar_cache_key} frame={me.avatar_frame_style}/>
      <div className="square-comment-composer-main" ref={editor}>
        {target&&<div className="research-reply-context"><span className="material-symbols-outlined" aria-hidden="true">reply</span><span><strong>{user(target.user_id).name}</strong><small>{target.body}</small></span><button type="button" onClick={()=>setReply(null)} aria-label={t('common.cancel')}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></div>}
        {editing&&!mobile?<><MarkdownInput value={body} onChange={setBody} rows={3}/><div className="research-comment-send"><button className="ghost-button" type="button" onClick={cancelEditing} disabled={busy}>{t('common.cancel')}</button><button className="square-comment-send" type="submit" disabled={busy||!body.trim()} aria-label={t('square.sendComment')}><span className="material-symbols-outlined">arrow_upward</span></button></div></>:<div className="research-progress-compose-row"><button type="button" className="research-progress-trigger" disabled={busy} onClick={beginEditing}><span>{body||t('research.md.mdPlaceholder')}</span><span className="material-symbols-outlined" aria-hidden="true">edit_note</span></button><button className="square-comment-send" type="submit" disabled={busy||!body.trim()} aria-label={t('square.sendComment')}><span className="material-symbols-outlined">arrow_upward</span></button></div>}
        <div className="research-response-options"><button type="button" className={requiresAnswer?'is-selected':''} aria-pressed={requiresAnswer} disabled={busy||!targets.length} onClick={()=>{if(!requiresAnswer){const candidate=target?.user_id===userId&&reply?byId.get(rootOf(reply))?.user_id:target?.user_id;setAnswerTarget(String(targets.find(m=>m.id===candidate)?.id||targets[0]?.id||''));}setRequiresAnswer(value=>!value);}}><span className="material-symbols-outlined" aria-hidden="true">flag</span>{t('researchFlow.needsAnswer')}</button>{requiresAnswer&&<SelectControl compact label={t('researchFlow.answerTarget')} value={answerTarget||String(targets[0]?.id||'')} onChange={setAnswerTarget} options={targets.map(m=>({value:String(m.id),label:m.name}))} disabled={busy}/>}</div>
        {sendError&&!(editing&&mobile)&&<p className="research-comment-error" role="alert">{sendError}</p>}
      </div>
    </CommentComposer>}
    {writable&&editing&&mobile&&<MarkdownEditorDialog title={t('research.progress')} initialValue={body} onChange={setBody} busy={busy} error={sendError} confirmLabel={t('square.sendComment')} onClose={cancelEditing} onSave={value=>void submit(value)}/>}
    <SideDrawer open={!!awarding} historyKey="research-comment-award" title={t('researchFlow.award')} onClose={()=>{if(!busy)setAwarding(null);}}>{awarding&&<ResearchAwardForm key={awarding.awardId||awarding.sourceId} award={project.workflow?.comment_awards?.find(item=>item.id===awarding.awardId)} project={project} userId={awarding.userId} sourceId={awarding.sourceId} busy={busy} mutate={mutate} onDone={()=>setAwarding(null)}/>}</SideDrawer>
    <SideDrawer headerless historyKey="research-comment-profile" open={!!profile} onClose={()=>setProfile(null)} title={t('profile.details')}>{profile&&<UserProfilePanel userId={profile.user_id} initialUser={profile}/>}</SideDrawer>
  </section>;
}
