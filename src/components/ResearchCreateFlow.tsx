import { useState } from 'react';
import { InputDialog } from './InputDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { SideDrawer } from './SideDrawer';
import { DateRangeField, type ResearchDateRange } from './DateRangeField';
import { MarkdownInput } from './ResearchMarkdownInput';
import { useI18n } from '../lib/language';

export type ResearchDraft = {title:string;start:string;end:string|null;description:string};

export function ResearchCreateFlow({busy,error,onClose,onCreate}:{
  busy:boolean;error:string;onClose:()=>void;onCreate:(draft:ResearchDraft)=>Promise<boolean>;
}) {
  const {t}=useI18n();
  const [step,setStep]=useState<'name'|'dates'|'description'>('name');
  const [title,setTitle]=useState(''),[description,setDescription]=useState('');
  const [range,setRange]=useState<ResearchDateRange>({from:new Intl.DateTimeFormat('sv-SE').format(new Date()),to:''});
  async function create(skip=false){
    if(busy||!title.trim())return;
    await onCreate({title:title.trim(),start:range.from,end:range.to||null,description:skip?'':description});
  }
  return <>
    <InputDialog open={step==='name'} title={t('research.create')} description={t('research.createNameHint')} value={title} maxLength={50} placeholder={t('research.name')} onChange={setTitle} onClose={onClose} confirmDisabled={!title.trim()} confirmLabel={t('common.next')} onConfirm={()=>{if(title.trim())setStep('dates');}}/>
    <ConfirmDialog open={step==='dates'} title={t('research.createDates')} description={title} cancelLabel={t('common.back')} confirmLabel={t('common.next')} onClose={()=>setStep('name')} onConfirm={()=>setStep('description')}>
      <div className="research-create-dates"><DateRangeField value={range} onChange={setRange}/></div>
    </ConfirmDialog>
    <SideDrawer historyKey="research-create-description" open={step==='description'} fullscreen title={t('research.description')} onClose={()=>{if(!busy)setStep('dates');}} headerAction={<button className="ghost-button" type="button" disabled={busy} onClick={()=>void create(true)}>{t('research.skipDescription')}</button>}>
      <form className="research-form research-create-description" onSubmit={event=>{event.preventDefault();void create();}}>
        <div className="research-create-summary"><strong>{title}</strong><span>{range.from} — {range.to||t('square.distantFuture')}</span></div>
        <MarkdownInput value={description} onChange={setDescription} rows={10}/>
        {error&&<p className="research-error" role="alert">{error}</p>}
        <button className="button" type="submit" disabled={busy}>{busy?t('common.processing'):t('research.create')}</button>
      </form>
    </SideDrawer>
  </>;
}
