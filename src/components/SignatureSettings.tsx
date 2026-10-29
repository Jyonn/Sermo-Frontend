import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/language';
import { signaturePresets, SIGNATURE_MAX_LENGTH } from '../lib/signature';
import { SideDrawer } from './SideDrawer';
import { InputDialog } from './InputDialog';
import { SettingGroup, SettingRow } from './SettingRow';

export function SignatureSettings({open,value,onSave,onClose,onOpen}:{open:boolean;value:string;onSave:(value:string)=>Promise<void>;onClose:()=>void;onOpen:()=>void}) {
  const {t}=useI18n();
  const [custom,setCustom]=useState(false),[draft,setDraft]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{if(!open){setCustom(false);setError('');}},[open]);
  async function save(next:string){if(busy)return;setBusy(true);setError('');try{await onSave(next.trim());if(active.current)onClose();}catch(e){if(active.current)setError(e instanceof Error?e.message:t('common.operationFailed'));}finally{if(active.current)setBusy(false);}}
  function check(selected:boolean){return selected?<span className="material-symbols-outlined" aria-label={t('signature.selected')}>check</span>:null;}
  return <SideDrawer open={open} onRouteOpen={onOpen} historyKey="profile-signature" title={t('signature.title')} onClose={()=>{if(!busy)onClose();}}>
    <div className="detail-list">
      <p className="muted">{t('signature.hint')}</p>
      {error&&!custom&&<p className="research-error" role="alert">{error}</p>}
      <SettingGroup>{signaturePresets.map(preset=><SettingRow key={preset} title={preset} trailing={check(value===preset)} disabled={busy} onClick={()=>void save(preset)}/>)}</SettingGroup>
      <SettingGroup><SettingRow title={t('signature.custom')} description={value&&!signaturePresets.some(preset=>preset===value)?value:undefined} disabled={busy} onClick={()=>{setDraft(value);setError('');setCustom(true);}}/><SettingRow title={t('signature.clear')} disabled={busy} trailing={check(!value)} onClick={()=>void save('')}/></SettingGroup>
    </div>
    <InputDialog open={open&&custom} title={t('signature.custom')} description={error||t('signature.limit',{count:SIGNATURE_MAX_LENGTH})} value={draft} maxLength={SIGNATURE_MAX_LENGTH} busy={busy} onChange={setDraft} onClose={()=>setCustom(false)} onConfirm={()=>void save(draft)}/>
  </SideDrawer>;
}
