import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { useI18n } from '../lib/language';
import type { ResearchProject, ResearchTask } from '../lib/research';
import type { SquareStatementCommentDTO, TinyUserDTO } from '../types';
import './ResearchComments.css';

export function ResearchComments({project,task,userId,scope,writable,busy,send,children}:{
  project:ResearchProject;task:ResearchTask;userId:number;scope:string;writable:boolean;busy:boolean;
  send:(body:string,replyTo?:string)=>Promise<boolean>;
  children?:ReactNode;
}) {
  const {t}=useI18n();
  const [body,setBody]=useState(''),[reply,setReply]=useState<string|null>(null);
  const [editing,setEditing]=useState(false),[sendError,setSendError]=useState('');
  const mobile=useMobileMarkdownMode();
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
  const byId=new Map(items.map(item=>[item.id,item]));
  const rootOf=(id:string)=>{
    let current=byId.get(id);const visited=new Set<string>();
    while(current?.reply_to&&!visited.has(current.id)&&byId.has(current.reply_to)){visited.add(current.id);current=byId.get(current.reply_to);}
    return current?.id||id;
  };
  const dto=(item:ResearchTask['progress'][number]):SquareStatementCommentDTO=>({
    comment_id:commentId(item.id),statement_id:0,user:user(item.user_id),text:item.body,
    created_at:Date.parse(item.created_at)/1000,like_count:0,reply_count:0,liked:false,can_delete:false,
    parent_id:item.reply_to?commentId(rootOf(item.id)):null,
    reply_to_user:item.reply_to?user(byId.get(item.reply_to)?.user_id||item.user_id):null,
  });
  const comments=items.filter(item=>!item.reply_to||!byId.has(item.reply_to)).map(item=>{
    const replies=items.filter(entry=>entry.id!==item.id&&rootOf(entry.id)===item.id);
    return {...dto(item),replies:replies.map(dto),reply_count:replies.length};
  }).filter(comment=>scope==='all'||comment.user.user_id===userId||comment.replies.some(entry=>entry.user.user_id===userId));
  const target=reply?byId.get(reply):undefined;
  const me=user(userId);
  function beginEditing(){draftBeforeEdit.current=body;setSendError('');setEditing(true);}
  function cancelEditing(){setBody(draftBeforeEdit.current);setEditing(false);setSendError('');}
  async function submit(value:string){
    if(busy||!value.trim())return;
    setSendError('');
    if(await send(value,reply||undefined)){setBody('');setReply(null);setEditing(false);}
    else setSendError(t('research.failed'));
  }
  return <section className={`research-task-comments${editing&&!mobile?' is-composing':''}`}>
    <div className="research-comments-scroll">
      {children}
      <div className="square-comment-list">{comments.map(comment=><CommentThread key={record(comment.comment_id).id} comment={comment} canInteract={writable} expanded={expanded===comment.comment_id} onToggleReplies={id=>setExpanded(current=>current===id?null:id)} onDelete={()=>{}} onOpenProfile={setProfile} onReply={entry=>{setReply(record(entry.comment_id).id);setExpanded(entry.parent_id||entry.comment_id);beginEditing();}} renderContent={(entry,onReply)=><div onClick={onReply}><Markdown body={entry.text}/></div>}/>)}</div>
      {!comments.length&&<QuietState icon="forum" title={t('research.noProgress')} description={t('research.progressEmptyHint')}/>}
    </div>
    {writable&&<CommentComposer onSubmit={event=>{event.preventDefault();void submit(body);}}>
      <UserAvatar className="square-comment-avatar" name={me.name} uri={me.avatar_uri} cacheKey={me.avatar_cache_key} frame={me.avatar_frame_style}/>
      <div className="square-comment-composer-main" ref={editor}>
        {target&&<div className="research-reply-context"><span className="material-symbols-outlined" aria-hidden="true">reply</span><span><strong>{user(target.user_id).name}</strong><small>{target.body}</small></span><button type="button" onClick={()=>setReply(null)} aria-label={t('common.cancel')}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></div>}
        {editing&&!mobile?<><MarkdownInput value={body} onChange={setBody} rows={3}/><div className="research-comment-send"><button className="ghost-button" type="button" onClick={cancelEditing} disabled={busy}>{t('common.cancel')}</button><button className="square-comment-send" type="submit" disabled={busy||!body.trim()} aria-label={t('square.sendComment')}><span className="material-symbols-outlined">arrow_upward</span></button></div></>:<div className="research-progress-compose-row"><button type="button" className="research-progress-trigger" disabled={busy} onClick={beginEditing}><span>{body||t('research.md.mdPlaceholder')}</span><span className="material-symbols-outlined" aria-hidden="true">edit_note</span></button><button className="square-comment-send" type="submit" disabled={busy||!body.trim()} aria-label={t('square.sendComment')}><span className="material-symbols-outlined">arrow_upward</span></button></div>}
        {sendError&&!(editing&&mobile)&&<p className="research-comment-error" role="alert">{sendError}</p>}
      </div>
    </CommentComposer>}
    {writable&&editing&&mobile&&<MarkdownEditorDialog title={t('research.progress')} initialValue={body} onChange={setBody} busy={busy} error={sendError} confirmLabel={t('square.sendComment')} onClose={cancelEditing} onSave={value=>void submit(value)}/>}
    <SideDrawer headerless historyKey="research-comment-profile" open={!!profile} onClose={()=>setProfile(null)} title={t('profile.details')}>{profile&&<UserProfilePanel userId={profile.user_id} initialUser={profile}/>}</SideDrawer>
  </section>;
}
