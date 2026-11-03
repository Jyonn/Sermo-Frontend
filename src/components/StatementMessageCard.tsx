import {useNavigate} from 'react-router-dom';
import type {SquareStatementDTO} from '../types';
import {useI18n} from '../lib/language';
import {SquareNoteCard} from './SquareMasonryFeed';
import './StatementMessageCard.css';

export function StatementMessageCard({statement}:{statement:SquareStatementDTO|null|undefined}){
  const {t}=useI18n(),navigate=useNavigate();
  if(!statement)return <div className="message-statement-card is-unavailable"><span className="material-symbols-outlined">speaker_notes_off</span><span><strong>{t('message.statementUnavailable')}</strong><small>{t('message.statementUnavailableHint')}</small></span></div>;
  const open=()=>navigate(`/app/square/statements/${statement.statement_id}?view=note`);
  return <div className="message-statement-card is-note"><SquareNoteCard item={statement} canInteract onOpen={open} onLike={open} onProfile={open}/></div>;
}
