import {useEffect,useState} from 'react';
import {api,ApiError} from '../lib/api';
import {useI18n} from '../lib/language';
import {rememberExternalPickerReturn} from '../lib/externalPickerReturn';
import {DROP_API_ORIGIN,DROP_ICON,DROP_ORIGIN} from '../lib/dropPicker';
import {SideDrawer} from './SideDrawer';
import {BottomSheet} from './BottomSheet';
import {ConfirmDialog} from './ConfirmDialog';
import {FeedbackState} from './FeedbackState';
import {DropPickerFrame} from './DropPickerFrame';
import './PockloDrawer.css';

export function DropDrawer({open,onClose,scope,returnError,onShare}:{open:boolean;onClose:()=>void;scope:string;returnError?:string;onShare?:(url:string)=>Promise<boolean|void>}){
  const {t}=useI18n(),[status,setStatus]=useState(''),[client,setClient]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[disconnect,setDisconnect]=useState(false);
  useEffect(()=>{if(!open){setStatus('');setDisconnect(false);return}let active=true;setError(returnError??'');api.dropConnection().then(value=>{if(active){setStatus(value.status??'unavailable');setClient(value.client_id??'')}}).catch(()=>{if(active)setStatus('unavailable')});return()=>{active=false}},[open,scope,returnError,revision]);
  async function connect(){setBusy(true);setError('');try{const{authorize_url}=await api.dropConnection({action:'connect',origin:location.origin,path:location.pathname});const url=new URL(authorize_url??'');if(url.origin!==DROP_API_ORIGIN||url.pathname!=='/oauth/authorize/'||url.username||url.password||url.hash)throw Error();rememberExternalPickerReturn('drop',scope,location.pathname);location.assign(url.href)}catch{setError('unavailable');setBusy(false)}}
  async function revoke(){setBusy(true);try{await api.dropConnection({action:'disconnect'});setDisconnect(false);setStatus('connect_required')}catch(cause){setError(cause instanceof ApiError?cause.identifier:'unavailable')}finally{setBusy(false)}}
  if(open&&onShare&&status==='connected'&&client)return <DropPickerFrame key={scope} clientId={client} onClose={onClose} onShare={onShare} onConnectionError={()=>{setStatus('connect_required');setError('connect_required')}}/>;
  const content=<div className="pocklo-drawer"><div className="pocklo-identity"><img src={DROP_ICON} alt="" width={44} height={44}/><div><strong>{t('drop.name')}</strong><p>{t('drop.hint')}</p></div>{status==='connected'?<span className="pocklo-status" data-connected="true"><span/>{t('drop.connected')}</span>:null}</div>
    {!status?<FeedbackState tone="loading" title={t('common.loading')}/>:<div className="pocklo-connection">{status==='unavailable'?<FeedbackState tone="error" title={t('drop.unavailable')}/>:status!=='connected'?<p>{t('drop.connectHint')}</p>:null}{error?<p role="alert" className="pocklo-notice">{t(error==='denied'?'drop.denied':'drop.unavailable')}</p>:null}<div className="button-row">{status==='connected'?<><a href={DROP_ORIGIN} target="_blank" rel="noopener noreferrer" className="button">{t('drop.open')}</a><button className="ghost-button" type="button" onClick={()=>setDisconnect(true)}>{t('drop.disconnect')}</button></>:status==='unavailable'?<button type="button" className="button" onClick={()=>setRevision(x=>x+1)}>{t('common.retry')}</button>:<button className="button" type="button" disabled={busy} onClick={()=>void connect()}>{t(busy?'common.loading':'drop.connect')}</button>}</div></div>}
  </div>;
  return <>{onShare?<BottomSheet open={open} onClose={onClose} title={t('drop.name')}>{content}</BottomSheet>:<SideDrawer historyKey="drop" open={open} onClose={onClose} title={t('drop.name')}>{content}</SideDrawer>}<ConfirmDialog open={disconnect} title={t('drop.disconnect')} description={t('drop.disconnectHint')} busy={busy} onClose={()=>{if(!busy)setDisconnect(false)}} onConfirm={()=>void revoke()} confirmLabel={t('drop.disconnect')}/></>;
}
