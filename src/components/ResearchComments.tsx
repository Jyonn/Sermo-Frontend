import { useRef, useState } from 'react';
import { CommentThread } from './CommentThread';
import { CommentComposer } from './CommentComposer';
import { Markdown } from './ResearchMarkdown';
import { MarkdownInput } from './ResearchMarkdownInput';
import { QuietState } from './BoundaryState';
import { UserAvatar } from './UserAvatar';
import { UserProfilePanel } from './UserProfilePanel';
import { SideDrawer } from './SideDrawer';
import { useI18n } from '../lib/language';
import type { ResearchProject, ResearchTask } from '../lib/research';
import type { SquareStatementCommentDTO, TinyUserDTO } from '../types';

export function ResearchComments({project,task,userId,scope,writable,busy,send}:{
  project:ResearchProject;task:ResearchTask;userId:number;scope:string;writable:boolean;busy:boolean;
  send:(body:string,replyTo?:string)=>Promise<boolean>;
}) {
  const {t}=useI18n();
  const [body,setBody]=useState(''),[reply,setReply]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<number|null>(null),[profile,setProfile]=useState<TinyUserDTO|null>(null);
  const commentIds=useRef(new Map<string,number>());
  for(const item of task.progress)if(!commentIds.current.has(item.id))commentIds.current.set(item.id,commentIds.current.size+1);
  const commentId=(id:string)=>commentIds.current.get(id)!;
  const record=(id:number)=>task.progress.find(item=>commentId(item.id)===id)!;
  const editor=useRef<HTMLDivElement>(null);
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
  return <section className="research-task-comments">
    {writable&&<CommentComposer onSubmit={async event=>{event.preventDefault();if(busy||!body.trim())return;if(await send(body,reply||undefined)){setBody('');setReply(null);}}}>
      <UserAvatar className="square-comment-avatar" name={me.name} uri={me.avatar_uri} frame={me.avatar_frame_style}/>
      <div className="square-comment-composer-main" ref={editor}>
        {target&&<div className="square-reply-target"><span>{t('square.reply')} {user(target.user_id).name}</span><button className="ghost-button" type="button" onClick={()=>setReply(null)} aria-label={t('common.cancel')}><span className="material-symbols-outlined">close</span></button></div>}
        <MarkdownInput value={body} onChange={setBody}/>
        <div className="research-comment-send"><button className="square-comment-send" type="submit" disabled={busy||!body.trim()} aria-label={t('square.sendComment')}><span className="material-symbols-outlined">arrow_upward</span></button></div>
      </div>
    </CommentComposer>}
    <div className="square-comment-list">{comments.map(comment=><CommentThread key={record(comment.comment_id).id} comment={comment} canInteract={writable} expanded={expanded===comment.comment_id} onToggleReplies={id=>setExpanded(current=>current===id?null:id)} onDelete={()=>{}} onOpenProfile={setProfile} onReply={entry=>{setReply(record(entry.comment_id).id);setExpanded(entry.parent_id||entry.comment_id);editor.current?.scrollIntoView({block:'nearest'});editor.current?.querySelector('textarea')?.focus({preventScroll:true});}} renderContent={(entry,onReply)=><div onClick={onReply}><Markdown body={entry.text}/></div>}/>)}</div>
    {!comments.length&&<QuietState icon="forum" title={t('research.noProgress')} description={t('research.progressEmptyHint')}/>}
    <SideDrawer headerless historyKey="research-comment-profile" open={!!profile} onClose={()=>setProfile(null)} title={t('profile.details')}>{profile&&<UserProfilePanel userId={profile.user_id} initialUser={profile}/>}</SideDrawer>
  </section>;
}
