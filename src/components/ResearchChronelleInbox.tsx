import {useEffect,useState} from 'react';
import {useI18n} from '../lib/language';
import {eventDateRange, defaultTimezone, eventScope, useChronelleCopy, useChronelleQuery, useChronelleWrite, type CalendarInbox, type CalendarInvitation, type ChronelleGroup, type RecurrenceScope} from '../lib/researchChronelle';
import {PageTabs} from './PageTabs';
import {QuietState} from './BoundaryState';
import {PlainAvatar} from './UserAvatar';
import {SideDrawer} from './SideDrawer';
import {SettingsDialog} from './SettingsDialog';
import {ConfirmDialog} from './ConfirmDialog';
import {CalendarDestination, type Destination} from './ResearchChronelleFields';
import {EventOverview, ResearchChronelleEditor, type CalendarEventDraft} from './ResearchChronelleEvent';
import {ChronelleLoad, type InvitationSelection} from './ResearchChronelleAgenda';
import {newMeetingRange} from '../lib/researchMeetingTime';

type InboxTab='pending'|'sent'|'history';
type ResponseAction='accept'|'decline'|'withdraw'|'cancel';
const matches=(item:CalendarInvitation,tab:InboxTab)=>
  tab==='pending'?item.can_respond:tab==='sent'?item.role==='sender'&&item.can_cancel:!item.can_respond&&!(item.role==='sender'&&item.can_cancel);

export function ResearchChronelleInbox({project,groups,writable,revision,onChanged,onOpen,openTeamInvitation}:{
  project:number;groups:ChronelleGroup[];writable:boolean;revision:number;onChanged:()=>void;
  onOpen:(selection:InvitationSelection)=>void;openTeamInvitation:()=>void;
}) {
  const {t,language}=useI18n();
  const {copy}=useChronelleCopy();
  const [tab,setTab]=useState<InboxTab>('pending');
  const [newInvitation,setNewInvitation]=useState(false);
  const [clientId,setClientId]=useState('');
  const [offset,setOffset]=useState(0);
  const [older,setOlder]=useState<CalendarInvitation[]>([]);
  const response=useChronelleQuery<CalendarInbox>(project,'invitations',offset?{offset:String(offset)}:undefined,revision);
  const write=useChronelleWrite(project);
  const current=response.value;
  const rows=[...new Map([...older,...(current?.items??[])].map(item=>[item.id,item])).values()];
  const visible=rows.filter(item=>matches(item,tab));
  useEffect(()=>{setOffset(0);setOlder([]);},[revision]);
  useEffect(()=>{
    if(!response.refreshing&&current?.has_more&&tab==='pending'&&current.pending_received>visible.length){
      setOlder(rows);setOffset(current.next_offset);
    }
  },[current,tab,visible.length,response.refreshing]);

  return <section className="research-chronelle-inbox">
    <div className="research-inbox-header">
      <PageTabs label={copy('inbox')} value={tab} onChange={setTab}
        items={(['pending','sent','history'] as const).map(value=>({value,label:copy('inbox.'+value)
          +(value==='pending'&&current?.pending_received? ` · ${current.pending_received}` : '')}))}/>
      {writable&&<div className="research-chronelle-actions">
        <button type="button" className="ghost-button" onClick={()=>{setClientId(crypto.randomUUID());setNewInvitation(true);}}>{copy('emailInvitation')}</button>
        <button type="button" className="button" onClick={openTeamInvitation}>{copy('newMeeting')}</button>
      </div>}
    </div>
    <ChronelleLoad loading={response.loading&&!older.length} error={response.error} onRetry={response.refresh}>
      {visible.length>0 ? <div className="research-agenda-list">{visible.map(item=><button className="research-inbox-row" type="button" key={item.id} onClick={()=>onOpen({id:item.id})}>
        <PlainAvatar className="research-calendar-avatar" name={item.sender.name} uri={item.sender.avatar_url}/>
        <span className="research-agenda-copy"><strong>{item.title}</strong><small>{item.sender.name} · {eventDateRange(item,language)}</small></span>
        <span className="research-agenda-tag" data-status={item.role==='sender'?item.status:item.my_status}>{copy('status.'+(item.role==='sender'?item.status:item.my_status))}</span>
        <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </button>)}</div>:!response.loading&&<QuietState icon="inbox" title={copy('empty.'+tab)}/>}
      {current?.has_more&&<button type="button" className="ghost-button" onClick={()=>{setOlder(rows);setOffset(current.next_offset);}}>{t('common.loadMore')}</button>}
    </ChronelleLoad>
    {newInvitation&&<SideDrawer open showTitle historyKey="chronelle-invite" className="research-workflow-drawer" title={copy('emailInvitation')} onClose={()=>setNewInvitation(false)}>
      <ResearchChronelleEditor range={newMeetingRange(Date.now(),defaultTimezone)} groups={groups} invitationEmails
        onSave={async(draft,emails)=>{
          const result=await write<CalendarInvitation>('invitations','POST',{...draft,emails,client_id:clientId});
          setNewInvitation(false);setTab('sent');onChanged();onOpen({id:result.id});
        }}/>
    </SideDrawer>}
  </section>;
}

export function ResearchChronelleInvitation({project,selection,groups,writable,onClose,onChanged}:{
  project:number;selection:InvitationSelection;groups:ChronelleGroup[];writable:boolean;onClose:()=>void;onChanged:()=>void;
}) {
  const {t}=useI18n();
  const {copy,errorText}=useChronelleCopy();
  const query=selection.occurrence?{occurrence_start:selection.occurrence}:undefined;
  const result=useChronelleQuery<CalendarInvitation>(project,`invitation/${selection.id}`,query);
  const event=result.value;
  const write=useChronelleWrite(project);
  const [response,setResponse]=useState<ResponseAction>();
  const [destination,setDestination]=useState<Destination>();
  const [reply,setReply]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [selectScope,setSelectScope]=useState(false);
  const [edit,setEdit]=useState<RecurrenceScope>();
  const [justThis,setJustThis]=useState(false);
  const editorResult=useChronelleQuery<CalendarInvitation>(project,edit==='all'&&query?`invitation/${selection.id}`:null);
  const editedEvent=edit==='all'&&query?editorResult.value:event;
  const answer=(action:ResponseAction)=>{
    setError('');setReply('');setJustThis(false);setResponse(action);
    setDestination({group_id:event?.group_id??groups[0]?.id??null,category_id:event?.category_id??null});
  };
  async function respond() {
    if(!response||!event||busy)return;
    setBusy(true);setError('');
    try {
      const accepting=response==='accept';
      await write(`respond/${event.id}`,'POST',{
        action:response,reply,...(response==='accept'||response==='decline'?{proposal_version:event.proposal_version}:{version:event.version}),
        ...(accepting?destination:{}),
        ...(justThis&&selection.occurrence?{scope:'single',occurrence_start:selection.occurrence}:{}),
      });
      onChanged();
    } catch(cause){setError(errorText(cause));}
    finally{setBusy(false);}
  }
  async function editInvitation(draft:CalendarEventDraft) {
    if(!editedEvent||!edit)return;
    const {remote_id,...changes}=draft;
    await write(`invitation/${editedEvent.id}`,'PATCH',{...changes,version:editedEvent.version,
      ...(edit!=='all'&&selection.occurrence?eventScope(edit,selection.occurrence):{})});
    onChanged();
  }
  return <SideDrawer open showTitle title={copy(edit?'editEvent':'invitationDetails')} historyKey="chronelle-invitation"
    className="research-workflow-drawer" onClose={onClose}>
    <ChronelleLoad loading={result.loading} error={result.error} onRetry={result.refresh}>
      {event&&(edit ? <ChronelleLoad loading={editorResult.loading} error={editorResult.error} onRetry={editorResult.refresh}>
        {editedEvent&&<ResearchChronelleEditor key={edit+editedEvent.id} initial={editedEvent} groups={groups}
          range={{...editedEvent,timezone:editedEvent.timezone||defaultTimezone}} timing={editedEvent.can_edit} repeat={edit!=='single'}
          onCancel={()=>setEdit(undefined)} onSave={editInvitation}/>}
      </ChronelleLoad> : <>
        <EventOverview event={event} groups={groups}/>
        <section className="research-invitation-people">
          <h3>{copy('participants')}</h3>
          <ul>{event.participants.map(person=><li key={person.id}><PlainAvatar className="research-calendar-avatar" name={person.name} uri={person.avatar_url}/>
            <span><strong>{person.name}</strong>{person.reply&&<small>{person.reply}</small>}</span>
            <small>{copy(person.organizer?'organizer':'status.'+person.status)}</small></li>)}</ul>
        </section>
        {writable&&<div className="research-chronelle-actions">
          {event.can_cancel&&<button type="button" className="ghost-button research-chronelle-danger" onClick={()=>answer('cancel')}>{copy('respond.cancel')}</button>}
          {event.can_withdraw&&<button type="button" className="ghost-button research-chronelle-danger" onClick={()=>answer('withdraw')}>{copy('respond.withdraw')}</button>}
          {event.can_respond&&<>
            <button type="button" className="ghost-button" onClick={()=>answer('decline')}>{copy('respond.decline')}</button>
            <button type="button" className="button" onClick={()=>answer('accept')}>{copy('respond.accept')}</button>
          </>}
          {(event.can_edit||event.can_edit_content)&&<button type="button" className="button" onClick={()=>selection.occurrence&&event.can_edit?setSelectScope(true):setEdit('all')}>{copy('editEvent')}</button>}
        </div>}
      </>)}
    </ChronelleLoad>
    <SettingsDialog open={selectScope} title={copy('scope')} onClose={()=>setSelectScope(false)}>
      <div className="research-chronelle-scope">{(['single','future','all'] as const).map(scope=><button key={scope} type="button" className="ghost-button"
        onClick={()=>{setEdit(scope);setSelectScope(false);}}>{copy('scope.'+scope)}</button>)}</div>
    </SettingsDialog>
    <ConfirmDialog open={!!response} title={copy('respond.'+response)} confirmLabel={copy('respond.'+response)} busy={busy}
      danger={response==='cancel'||response==='withdraw'} confirmDisabled={response==='accept'&&!destination?.group_id}
      onClose={()=>{setResponse(undefined);setError('');}} onConfirm={()=>void respond()}>
      <div className="research-form">
        {response==='accept'&&destination&&<CalendarDestination groups={groups} value={destination} onChange={setDestination}/>}
        {!!selection.occurrence&&(response==='cancel'||response==='withdraw')&&<label className="research-invitation-check">
          <input type="checkbox" checked={justThis} onChange={event=>setJustThis(event.target.checked)}/>{copy('scope.single')}
        </label>}
        <label>{copy('reply')}<textarea rows={3} maxLength={2000} value={reply} disabled={busy} onChange={e=>setReply(e.target.value)}/></label>
        {error&&<p className="research-form-error" role="alert">{error}</p>}
        {error&&<button type="button" className="ghost-button" onClick={()=>{setResponse(undefined);result.refresh();}}>{t('common.retry')}</button>}
      </div>
    </ConfirmDialog>
  </SideDrawer>;
}
