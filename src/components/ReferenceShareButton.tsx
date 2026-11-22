import {useState} from 'react';
import {useI18n} from '../lib/language';
import {api} from '../lib/api';
import {referenceTypes,type MessageReference} from '../lib/messageReferences';
import {ChatSharePicker} from './ChatSharePicker';
import {OverlayIconButton} from './OverlayIconButton';
import './SharedReferenceMessage.css';

export function ReferenceShareButton({reference,className=''}:{reference:MessageReference;className?:string}) {
  const {t} = useI18n();
  const [open, setOpen] = useState(false);
  return <>
    <OverlayIconButton icon="share" className={`reference-share-button ${className}`} aria-label={t('references.share')}
      onClick={event=>{event.stopPropagation();setOpen(true);}} />
    <ChatSharePicker open={open} title={t('square.shareToChat')} onClose={() => setOpen(false)}
      sendToChat={(id, clientId) => api.sendMessage(id, referenceTypes[reference.kind], JSON.stringify(reference), undefined, clientId)} />
  </>;
}
