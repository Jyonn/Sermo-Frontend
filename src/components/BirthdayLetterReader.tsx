import {useEffect,useRef,useState} from 'react';
import {api} from '../lib/api';
import {useI18n} from '../lib/language';
import type {BirthdayEnvelope} from '../lib/birthdayTypes';
import {ConfirmDialog} from './ConfirmDialog';

export function BirthdayLetterReader({letterId,onClose,onOpened}:{letterId:number|null;onClose:()=>void;onOpened?:(letter:BirthdayEnvelope)=>void}){
  const {t}=useI18n();const [record,setRecord]=useState<(BirthdayEnvelope&{body:string})|null>(null);const [failed,setFailed]=useState(false);
  const opened=useRef(onOpened);opened.current=onOpened;
  useEffect(()=>{
    if(letterId===null)return;const controller=new AbortController();setRecord(null);setFailed(false);
    void api.openBirthdayLetter(letterId,controller.signal).then(value=>{if(!controller.signal.aborted){setRecord(value);opened.current?.(value);}}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[letterId]);
  const value=record?.letter_id===letterId?record:null;
  return <ConfirmDialog open={letterId!==null} className="birthday-open-letter" title={value?.title??t('birthday.defaultLetterTitle')} description={value?.sender_name??t(failed?'birthday.letterUnavailable':'common.loading')} confirmLabel={t('birthday.keepLetter')} showCancelButton={false} onClose={onClose} onConfirm={onClose}><div className="birthday-letter-paper" aria-busy={!value&&!failed}>{value?.body}</div></ConfirmDialog>;
}
