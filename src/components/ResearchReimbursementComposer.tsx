import {useRef,useState,type FormEvent} from 'react';
import {useI18n,type TranslationKey} from '../lib/language';
import {uploadMessageMedia} from '../lib/messageUpload';
import {defaultDateRange} from '../lib/calendarDate';
import {normalizeMoney,reimbursementCny,reimbursementTotal} from '../lib/researchReimbursement';
import {SideDrawer} from './SideDrawer';
import {DateRangeField} from './DateRangeField';
import {SelectControl} from './SettingRow';
import type {ResearchMutation} from './ResearchWorkflow';
import type {ResearchReimbursementItem} from '../lib/research';
import './ResearchReimbursementComposer.css';

type Draft={id:string;title:string;amount:string;currency:string;exchange_rate:string;notes:string;payment:File|null;invoice:File|null;other:File[]};
const blank=():Draft=>({id:crypto.randomUUID(),title:'',amount:'',currency:'CNY',exchange_rate:'',notes:'',payment:null,invoice:null,other:[]});

export function ResearchReimbursementItems({items,onOpen}:{items:ResearchReimbursementItem[];onOpen:(resourceId:number)=>void}){
  const {t}=useI18n();
  return <div className="reimbursement-detail-items">{items.map(item=><section className="reimbursement-detail-item" key={item.id}><header><h3>{item.title}</h3><strong>¥{item.cny_amount}</strong></header><small>{item.currency} {item.amount}{item.currency!=='CNY'?` · ${t('researchFlow.fxQuote')} ${item.exchange_rate}`:''}</small>{item.notes&&<p>{item.notes}</p>}<div className="research-flow-actions"><button type="button" className="ghost-button" onClick={()=>onOpen(item.payment_id)}>{t('researchFlow.payment')}</button><button type="button" className="ghost-button" onClick={()=>onOpen(item.invoice_id)}>{t('researchFlow.invoice')}</button>{item.other_ids.map((id,index)=><button type="button" className="ghost-button" key={id} onClick={()=>onOpen(id)}>{t('researchFlow.otherFiles')} {index+1}</button>)}</div></section>)}</div>;
}
function EvidenceField({label,files,multiple=false,onChange}:{label:string;files:File[];multiple?:boolean;onChange:(files:File[])=>void}){
  const {t}=useI18n();
  return <label className="research-evidence-field"><span className="material-symbols-outlined" aria-hidden="true">attach_file</span><span><strong>{label}</strong><small>{files.length?files.map(file=>file.name).join(' · '):t('researchFlow.chooseEvidence')}</small></span><span className="material-symbols-outlined" aria-hidden="true">add</span><input type="file" accept="image/*,.pdf" multiple={multiple} onChange={event=>onChange(Array.from(event.target.files||[]).slice(0,multiple?6:1))}/></label>;
}

export function ResearchReimbursementComposer({currencies,busy,mutationError,mutate,onDone,onBusy}:{currencies:string[];busy:boolean;mutationError?:string;mutate:ResearchMutation;onDone:()=>void;onBusy:(busy:boolean)=>void}){
  const {t}=useI18n();
  const [title,setTitle]=useState(''),[range,setRange]=useState(defaultDateRange),[notes,setNotes]=useState(''),[items,setItems]=useState<Draft[]>([]),[draft,setDraft]=useState<Draft|null>(null);
  const [uploading,setUploading]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState('');
  const uploaded=useRef(new Map<File,number>());
  const total=reimbursementTotal(items);
  const converted=draft?reimbursementCny(draft.amount,draft.currency,draft.exchange_rate):null;
  const update=(value:Partial<Draft>)=>setDraft(current=>current?{...current,...value}:null);
  async function submit(event:FormEvent){
    event.preventDefault();if(uploading||busy||!items.length)return;setUploading(true);onBusy(true);setError('');setProgress(0);
    try{
      const count=items.reduce((sum,item)=>sum+2+item.other.length,0);let finished=0;
      async function upload(file:File){let id=uploaded.current.get(file);if(id===undefined){const result=await uploadMessageMedia(file,'file',value=>setProgress((finished+value/100)/count*100));id=result.resource.resource_id;uploaded.current.set(file,id);}finished++;setProgress(finished/count*100);return id;}
      const rows=[];
      for(const item of items){const payment_id=await upload(item.payment!),invoice_id=await upload(item.invoice!),other_ids=[];for(const file of item.other)other_ids.push(await upload(file));rows.push({title:item.title,amount:normalizeMoney(item.amount),currency:item.currency,exchange_rate:item.currency==='CNY'?'100.00':normalizeMoney(item.exchange_rate),payment_id,invoice_id,other_ids,notes:item.notes});}
      if(await mutate({action:'reimbursement',title,start:range.from,end:range.to,notes,items:rows}))onDone();else setError(t('research.failed'));
    }catch(e){setError(e instanceof Error?e.message:t('research.failed'));}finally{setUploading(false);onBusy(false);}
  }
  return <><form className="research-form reimbursement-composer" onSubmit={submit}>
    <label>{t('research.name')}<input required maxLength={160} value={title} onChange={event=>setTitle(event.target.value)} disabled={uploading||busy}/></label>
    <DateRangeField value={range} onChange={setRange}/>
    <section className="reimbursement-items"><header><h3>{t('researchFlow.expenseItems')}</h3><button className="ghost-button" type="button" disabled={uploading||busy||items.length>=50} onClick={()=>setDraft(blank())}><span className="material-symbols-outlined" aria-hidden="true">add</span>{t('researchFlow.addItem')}</button></header>
      {items.map((item,index)=><button className="reimbursement-item-row" key={item.id} type="button" disabled={uploading||busy} onClick={()=>setDraft({...item})}><span className="reimbursement-item-index">{String(index+1).padStart(2,'0')}</span><span><strong>{item.title}</strong><small>{item.currency} {normalizeMoney(item.amount)}</small></span><b>¥{reimbursementCny(item.amount,item.currency,item.exchange_rate)}</b><span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>)}
      {!items.length&&<p className="research-flow-hint">{t('researchFlow.itemsEmpty')}</p>}
    </section>
    <label>{t('researchFlow.totalNotes')}<textarea maxLength={4000} value={notes} onChange={event=>setNotes(event.target.value)} disabled={uploading||busy}/></label>
    <div className="reimbursement-total"><span>{t('researchFlow.cnyTotal')}</span><strong>¥{total||'0.00'}</strong></div>
    {(error||mutationError)&&<p className="research-error" role="alert">{error||mutationError}</p>}
    <button className="button" disabled={uploading||busy||!title.trim()||!items.length||!range.from||!range.to||!total||total==='0.00'}>{uploading?`${t('common.loading')} ${Math.round(progress)}%`:t('research.save')}</button>
  </form>
  <SideDrawer className="research-workflow-drawer" open={!!draft} historyKey="research-expense-item" title={t('researchFlow.expenseItem')} onClose={()=>setDraft(null)}>
    {draft&&<form className="research-form research-reward-editor" onSubmit={event=>{event.preventDefault();if(!converted||!draft.payment||!draft.invoice)return;const row={...draft,title:draft.title.trim(),amount:normalizeMoney(draft.amount),exchange_rate:draft.currency==='CNY'?'100.00':normalizeMoney(draft.exchange_rate)};setItems(old=>old.some(item=>item.id===row.id)?old.map(item=>item.id===row.id?row:item):[...old,row]);setDraft(null);}}>
      <label>{t('research.name')}<input required maxLength={160} value={draft.title} onChange={event=>update({title:event.target.value})}/></label>
      <div className="reimbursement-money"><label>{t('researchFlow.invoiceAmount')}<input inputMode="decimal" required pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" value={draft.amount} onChange={event=>update({amount:event.target.value})} onBlur={()=>update({amount:normalizeMoney(draft.amount)})}/></label><SelectControl label={t('researchFlow.currency')} value={draft.currency} options={currencies.map(code=>({value:code,label:t(('researchCurrency.'+code) as TranslationKey)+' '+code}))} onChange={currency=>update({currency,exchange_rate:''})}/></div>
      {draft.currency!=='CNY'&&<div className="reimbursement-fx"><a href="https://www.boc.cn/sourcedb/whpjSearch/index.html" target="_blank" rel="noopener noreferrer">{t('researchFlow.bocRates')}<span className="material-symbols-outlined" aria-hidden="true">open_in_new</span></a><label>{t('researchFlow.fxQuote')}<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" value={draft.exchange_rate} onChange={event=>update({exchange_rate:event.target.value})} onBlur={()=>update({exchange_rate:normalizeMoney(draft.exchange_rate)})}/></label><p>{t('researchFlow.fxHint',{currency:draft.currency})}</p></div>}
      <div className="reimbursement-total"><span>{t('researchFlow.cnyConverted')}</span><strong>{converted?`¥${converted}`:'—'}</strong></div>
      <EvidenceField label={t('researchFlow.payment')} files={draft.payment?[draft.payment]:[]} onChange={files=>update({payment:files[0]||null})}/>
      <EvidenceField label={t('researchFlow.invoice')} files={draft.invoice?[draft.invoice]:[]} onChange={files=>update({invoice:files[0]||null})}/>
      <EvidenceField label={t('researchFlow.otherFiles')} files={draft.other} multiple onChange={other=>update({other})}/>
      <label>{t('researchFlow.notes')}<textarea maxLength={4000} value={draft.notes} onChange={event=>update({notes:event.target.value})}/></label>
      <footer className="reimbursement-item-actions">{items.some(item=>item.id===draft.id)&&<button type="button" className="ghost-button" onClick={()=>{setItems(old=>old.filter(item=>item.id!==draft.id));setDraft(null);}}>{t('common.delete')}</button>}<button className="button" disabled={!draft.title.trim()||!draft.payment||!draft.invoice||!converted}>{t('research.save')}</button></footer>
    </form>}
  </SideDrawer></>;
}
