import { Link } from 'react-router-dom';
import type { ResearchMember, ResearchProject } from '../lib/research';
import { useI18n } from '../lib/language';
import { ResearchMemberGrid } from './ResearchPeople';
import { SettingGroup, SettingRow, SettingSelect } from './SettingRow';

export function ResearchProjectDetails({ project, owner, busy, onMember, onAdd, onRemove, onTransfer, onDanger, onStatus, onChat }: {
  project: ResearchProject; owner: boolean; busy: boolean;
  onMember: (member: ResearchMember) => void; onAdd: () => void;
  onRemove?: () => void;
  onChat?: () => void;
  onTransfer: () => void; onDanger: () => void;
  onStatus: (status: ResearchProject['status']) => Promise<void>;
}) {
  const { t } = useI18n();
  return <div className="chat-detail-panel research-project-details">
    <section className="chat-detail-people-section">
      <ResearchMemberGrid members={project.members} onMember={owner && !busy ? onMember : undefined} onAdd={owner && project.status !== 'completed' && !busy ? onAdd : undefined} onRemove={owner && !busy && project.members.some(member => !member.owner) ? onRemove : undefined}/>
    </section>
    <section className="chat-detail-settings-section">
      <SettingGroup>
        <Link className="research-chat-detail-link" to={`/app/chats/${project.chat_id}`} onClick={event=>{if(onChat){event.preventDefault();onChat();}}}>
          <span className="setting-row-icon"><span className="material-symbols-outlined" aria-hidden="true">forum</span></span>
          <strong>{t('research.group')}</strong><span className="material-symbols-outlined setting-row-chevron" aria-hidden="true">chevron_right</span>
        </Link>
      </SettingGroup>
    </section>
    <section className="chat-detail-settings-section">
      <SettingGroup>
        <SettingRow title={t('research.name')} description={project.title}/>
        {project.description && <SettingRow title={t('research.description')} description={project.description}/>}
        <SettingSelect label={t('research.status')} disabled={!owner || busy} value={project.status} options={(['planning','active','completed'] as const).map(value => ({ value, label: t(`research.${value}`) }))} onChange={onStatus}/>
        <SettingRow title={t('research.start')} value={project.start}/>
        <SettingRow title={t('research.end')} value={project.end || t('research.openEnd')}/>
      </SettingGroup>
    </section>
    <section className="chat-detail-danger-section">
      <SettingGroup>
        {owner && <SettingRow title={t('research.transferOwner')} disabled={busy || !project.members.some(member => !member.owner)} onClick={onTransfer}/>}
        <SettingRow title={t(owner ? 'research.dissolve' : 'research.leave')} tone="danger" disabled={busy} onClick={onDanger}/>
      </SettingGroup>
    </section>
  </div>;
}
