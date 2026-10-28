import { useState } from 'react';
import { InputDialog } from './InputDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { DateRangeField, type ResearchDateRange } from './DateRangeField';
import { MarkdownEditorDialog } from './MarkdownEditorDialog';
import { useI18n } from '../lib/language';

export type ResearchDraft = {title:string;start:string;end:string|null;description:string};

export function ResearchCreateFlow({busy,error,onClose,onCreate}:{
  busy:boolean;error:string;onClose:()=>void;onCreate:(draft:ResearchDraft)=>Promise<boolean>;
}) {
  const {t}=useI18n();
  const [step,setStep]=useState<'name'|'dates'|'description'>('name');
  const [title,setTitle]=useState(''),[description,setDescription]=useState('');
  const [range,setRange]=useState<ResearchDateRange>({from:new Intl.DateTimeFormat('sv-SE').format(new Date()),to:''});
  async function create(description=''){
    if(busy||!title.trim())return;
    await onCreate({title:title.trim(),start:range.from,end:range.to||null,description});
  }
  return <>
    <InputDialog open={step==='name'} title={t('research.create')} description={t('research.createNameHint')} value={title} maxLength={50} placeholder={t('research.name')} onChange={setTitle} onClose={onClose} confirmDisabled={!title.trim()} confirmLabel={t('common.next')} onConfirm={()=>{if(title.trim())setStep('dates');}}/>
    <ConfirmDialog open={step==='dates'} title={t('research.createDates')} description={title} cancelLabel={t('common.back')} confirmLabel={t('common.next')} onClose={()=>setStep('name')} onConfirm={()=>setStep('description')}>
      <div className="research-create-dates"><DateRangeField value={range} onChange={setRange}/></div>
    </ConfirmDialog>
    {step==='description'&&<MarkdownEditorDialog title={t('research.description')} initialValue={description} onChange={setDescription} summary={`${title} · ${range.from} — ${range.to||t('square.distantFuture')}`} busy={busy} error={error} confirmLabel={t('research.create')} skipLabel={t('research.skipDescription')} onClose={()=>setStep('dates')} onSave={value=>void create(value)} onSkip={()=>void create()}/>}
  </>;
}
