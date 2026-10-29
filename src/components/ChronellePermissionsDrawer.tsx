import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import {useI18n,type TranslationKey} from '../lib/language';
import {showToast} from '../lib/toast';
import {changeCalendarPermission,permissionMode,visibilityRank,type CalendarAudience,type CalendarPermissions,type CalendarVisibility,type ChronellePermissionsSetup} from '../lib/chronellePermissions';
import {SideDrawer} from './SideDrawer';
import {DrawerTabs} from './DrawerTabs';
import {SettingGroup,SettingRow,SettingSelect} from './SettingRow';
import {ContentLoader,QuietState} from './BoundaryState';
import {ConfirmDialog} from './ConfirmDialog';
import {FloatingDrawerScope} from './DesktopPanelWorkspace';
import './ChronellePluginDialog.css';

export function ChronellePermissionsDrawer({open,onClose,onChange,onRebind}:{open:boolean;onClose:()=>void;onChange?:()=>void;onRebind:()=>void}){
  const {t}=useI18n();
  const tr=(key:string)=>t(('chronelle.permissions.'+key) as TranslationKey);
  const [tier,setTier]=useState<CalendarAudience>('strangers');
  const [setup,setSetup]=useState<ChronellePermissionsSetup|null>(null),[policy,setPolicy]=useState<CalendarPermissions|null>(null);
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[unlink,setUnlink]=useState(false);
  useEffect(()=>{if(!open)return;const controller=new AbortController();setLoading(true);setError('');setSetup(null);setPolicy(null);
    api.chronellePermissions(controller.signal).then(value=>{if(!controller.signal.aborted){setSetup(value);setPolicy(value.audiences??null);}}).catch(()=>{if(!controller.signal.aborted)setError(tr('loadFailed'));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[open,retry]);
  const modeOptions=(id?:number)=>{
    const minimum=policy&&tier==='friends'?visibilityRank[permissionMode(policy.strangers,id)]:0;
    return (['hidden','busy','detail'] as CalendarVisibility[]).filter(mode=>visibilityRank[mode]>=minimum).map(mode=>({value:mode as CalendarVisibility|'inherit',label:tr(mode)}));
  };
  async function save(){if(!policy||busy)return;setBusy(true);setError('');try{
    const result=await api.saveChronellePermissions(policy);
    window.dispatchEvent(new Event('chronelle:permissions-saved'));
    if(result.rebind_required){showToast(tr('rebindRequired'));onRebind();}else{showToast(tr('saved'));onChange?.();onClose();}
  }catch{setError(tr('saveFailed'));}finally{setBusy(false);}}
  return <FloatingDrawerScope><SideDrawer open={open} onClose={()=>{if(!busy)onClose();}} historyKey="chronelle-permissions" title={tr('title')} className="chronelle-permissions-drawer">
    <div className="chronelle-permissions-content">
      {loading?<ContentLoader label={t('common.loading')} rows={4}/>:setup?.status==='active'&&policy?<>
        <DrawerTabs label={tr('title')} value={tier} onChange={setTier} items={[{value:'strangers',label:tr('strangers')},{value:'friends',label:tr('friends')}]}/>
        <p className="chronelle-permissions-hint">{tr('hierarchy')}</p>
        <SettingGroup><SettingSelect disabled={busy} label={tr('global')} value={policy[tier].default} options={modeOptions()} onChange={value=>setPolicy(changeCalendarPermission(policy,tier,value))}/></SettingGroup>
        <h3>{tr('groups')}</h3>
        {setup.groups.length?<SettingGroup>{setup.groups.map(group=>{
          const inherited=permissionMode({...policy[tier],overrides:{}},group.id);
          const canInherit=tier==='strangers'||visibilityRank[inherited]>=visibilityRank[permissionMode(policy.strangers,group.id)];
          const options=[...(canInherit?[{value:'inherit' as const,label:tr('inherit')+' · '+tr(inherited)}]:[]),...modeOptions(group.id)];
          return <SettingSelect key={group.id} label={group.name} disabled={busy} value={policy[tier].overrides[String(group.id)]??'inherit'} options={options} onChange={value=>setPolicy(changeCalendarPermission(policy,tier,value,group.id))}/>;
        })}</SettingGroup>:<QuietState icon="calendar_month" title={tr('noGroups')}/>}
        <p className="chronelle-permissions-hint">{tr('detailHint')}</p>
        <button type="button" className="button" disabled={busy} onClick={()=>void save()}>{busy?t('common.processing'):t('research.save')}</button>
        <SettingGroup><SettingRow title={tr('unbind')} tone="danger" disabled={busy} onClick={()=>setUnlink(true)}/></SettingGroup>
      </>:<QuietState icon="calendar_month" title={error||tr('unavailable')} action={<><button className="ghost-button" onClick={()=>setRetry(value=>value+1)}>{t('common.retry')}</button><button className="button" onClick={onRebind}>{t('chronelle.bind')}</button></>}/>}
      {error&&setup?.status==='active'&&<p role="alert" className="chronelle-permissions-error">{error}</p>}
    </div>
  </SideDrawer><ConfirmDialog open={unlink} busy={busy} danger title={tr('unbind')} description={t('research.calendarUI.unbindHint')} onClose={()=>{if(!busy)setUnlink(false);}} onConfirm={()=>{setBusy(true);void api.chronelleAccount('revoke',true).then(()=>{setUnlink(false);window.dispatchEvent(new Event('chronelle:bound'));onClose();onChange?.();}).catch(()=>{setUnlink(false);setError(tr('saveFailed'));}).finally(()=>setBusy(false));}}/></FloatingDrawerScope>;
}
