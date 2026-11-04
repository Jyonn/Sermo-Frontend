import type {CSSProperties,ReactNode} from 'react';
import {PlainAvatar} from './UserAvatar';
import './MemberAvatarStack.css';
export interface StackMember {id:number;name:string;uri?:string|null;cacheKey?:string}
export function MemberAvatarStack({members,label,subtitle,onClick,className='',size=32,limit=4,ariaLabel}:{members:StackMember[];label:ReactNode;subtitle?:ReactNode;onClick?:()=>void;className?:string;size?:number;limit?:number;ariaLabel?:string}){
  const Tag=onClick?'button':'div';
  return <Tag className={`member-avatar-stack ${className}`} style={{'--member-stack-size':`${size}px`} as CSSProperties} onClick={onClick} type={onClick?'button':undefined} aria-label={ariaLabel}>
    <span className="member-avatar-stack-faces" aria-hidden="true">{members.slice(0,limit).map(member=><PlainAvatar key={member.id} className="member-avatar-stack-face" name={member.name} uri={member.uri} cacheKey={member.cacheKey}/>)}</span>
    <span className="member-avatar-stack-copy"><span>{label}</span>{subtitle?<small>{subtitle}</small>:null}</span>
    {onClick?<span className="member-avatar-stack-chevron material-symbols-outlined" aria-hidden="true">chevron_right</span>:null}
  </Tag>;
}
