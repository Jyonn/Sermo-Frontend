import type {ReactNode} from 'react';
import {useI18n} from '../lib/language';
import './SquareFeedHeader.css';

export function SquareFeedHeader({children,search,publish,syncing}:{children:ReactNode;search:ReactNode;publish?:()=>void;syncing:boolean}){
  const {t}=useI18n();
  return <header className="square-feed-header" aria-busy={syncing}>
    <div className="square-feed-header-side">{search}</div>
    <nav className="square-feed-header-channels" aria-label={t('square.title')}>{children}</nav>
    <div className="square-feed-header-side">{publish?<button className="square-feed-publish" aria-label={t('square.publish')} title={t('square.publish')} onClick={publish} type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>:null}</div>
  </header>;
}
