import type { FormEventHandler, ReactNode, Ref } from 'react';

export function CommentComposer({children,onSubmit,formRef,anonymous=false}:{
  children:ReactNode;onSubmit:FormEventHandler<HTMLFormElement>;formRef?:Ref<HTMLFormElement>;anonymous?:boolean;
}) {
  return <form className={`square-comment-composer${anonymous?' is-anonymous':''}`} onSubmit={onSubmit} ref={formRef}>{children}</form>;
}
