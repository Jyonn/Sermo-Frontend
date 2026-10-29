import { useI18n } from '../lib/language';

export function FileDropGuide({resource=false}:{resource?:boolean}) {
  const {t}=useI18n();
  return <div className={`chat-file-drop-guide${resource?' resource-drop-guide':''}`} role="status">
    <div className="chat-file-drop-guide-card">
      <span className="chat-file-drop-guide-icon material-symbols-outlined" aria-hidden="true">upload_file</span>
      <strong>{t(resource?'resources.dropToUpload':'clipboard.dropToSend')}</strong>
      <span>{t(resource?'resources.dropHint':'clipboard.dropToReview')}</span>
    </div>
  </div>;
}
