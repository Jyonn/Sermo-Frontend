import { useEffect, useId, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { formatCloudResourceBytes } from '../lib/cloudResources';
import { localeForLanguage, useI18n, type TranslationKey } from '../lib/language';
import type { PermissionReason, PersonalPermission, PersonalPermissionQuotaSnapshot } from '../lib/permissionQuotas';
import { availableSquareQuota } from '../lib/squareQuota';
import { ContentLoader, QuietState } from './BoundaryState';
import { OverlayIconButton } from './OverlayIconButton';
import { SideDrawer } from './SideDrawer';
import './PermissionQuotaDrawer.css';

const sections = [
  { key: 'chat', label: 'permissionsQuotas.chat', icon: 'forum' },
  { key: 'square', label: 'permissionsQuotas.square', icon: 'explore' },
  { key: 'social', label: 'permissionsQuotas.external', icon: 'link' },
  { key: 'research', label: 'research.title', icon: 'science' },
] as const;

const chatSendLabels = {
  image: 'media.image', audio: 'square.voice', video: 'square.video', file: 'media.file', location: 'messageSearch.locations',
} as const;
const chatGroupLabels = {
  create: 'permissionsQuotas.createGroup', join: 'permissionsQuotas.joinGroup',
  send: 'permissionsQuotas.sendToGroup', invite: 'permissionsQuotas.inviteGroup', rename: 'permissionsQuotas.renameGroup',
} as const;
const squareMediaLabels = { text: 'square.text', image: 'media.image', audio: 'square.voice', video: 'square.video' } as const;

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

function useQuotaLabels() {
  const { t, language } = useI18n();
  const beijingTime = (timestamp: number) => new Intl.DateTimeFormat(localeForLanguage(language), {
    month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23', timeZone: 'Asia/Shanghai',
  }).format(timestamp * 1000);
  const reasonLabel = (reason: PermissionReason, level?: number, until?: number | null) =>
    reason === 'muted' && until ? t('permissionsQuotas.mutedUntil', { time: beijingTime(until) })
      : t(`permissionsQuotas.reason.${reason}`, { level: level ?? 0 });
  const duration = (seconds: number) => t('permissionsQuotas.duration', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 });
  return { t, beijingTime, reasonLabel, duration };
}

function PermissionRow({ label, permission }: { label: string; permission: PersonalPermission }) {
  const { t, reasonLabel } = useQuotaLabels();
  return <li className="permission-quota-permission">
    <span>{label}</span>
    <span className={permission.allowed ? 'is-allowed' : undefined}>
      {permission.reason ? reasonLabel(permission.reason, permission.required_level, permission.until) : t('permissionsQuotas.available')}
    </span>
  </li>;
}

function LimitCard({ title, value, note, status, children }: {
  title: string; value?: string; note?: string; status?: string; children?: ReactNode;
}) {
  return <article className="permission-quota-card">
    <header><h3>{title}</h3>{value ? <strong>{value}</strong> : null}</header>
    {status ? <p className="permission-quota-status"><Icon name="info" />{status}</p> : null}
    {children}
    {note ? <p className="permission-quota-note">{note}</p> : null}
  </article>;
}

function UsageBar({ label, used, limit, format = String }: {
  label: string; used: number; limit: number | null; format?: (value: number) => string;
}) {
  const { t } = useI18n();
  const quantity = limit === null ? `${format(used)} / ${t('square.quotaUnlimitedShort')}` : `${format(used)} / ${format(limit)}`;
  return <div className="permission-quota-usage">
    <span>{label}</span><b>{quantity}</b>
    {limit !== null && limit > 0 ? <progress aria-label={label} aria-valuetext={quantity} value={Math.min(used, limit)} max={limit} /> : null}
  </div>;
}

function PermissionDetails({ label, children }: { label: string; children: ReactNode }) {
  return <details className="permission-quota-details">
    <summary>{label}<Icon name="expand_more" /></summary>
    <ul>{children}</ul>
  </details>;
}

function ChatQuotas({ chat }: { chat: PersonalPermissionQuotaSnapshot['chat'] }) {
  const { t, beijingTime, duration, reasonLabel } = useQuotaLabels();
  const { voice, storage } = chat;
  return <>
    <LimitCard title={t('permissionsQuotas.calls')}
      value={voice.usage ? t('permissionsQuotas.durationRemaining', { duration: duration(voice.usage.remaining) }) : undefined}
      status={voice.reason ? reasonLabel(voice.reason) : undefined}
      note={voice.usage ? t('permissionsQuotas.voiceScope') : undefined}>
      {voice.usage ? <>
        <UsageBar label={t('permissionsQuotas.weeklyAllocated')} used={voice.usage.used + voice.usage.reserved} limit={voice.limit} format={duration} />
        {voice.usage.reserved > 0 ? <p className="permission-quota-note">{t('permissionsQuotas.reserved', { duration: duration(voice.usage.reserved) })}</p> : null}
        <p className="permission-quota-note">{t('permissionsQuotas.resetAt', { time: beijingTime(voice.reset_at) })}</p>
      </> : null}
    </LimitCard>
    <LimitCard title={t('permissionsQuotas.storage')} note={t('permissionsQuotas.storageHint')}>
      <UsageBar label={t('permissionsQuotas.used')} used={storage.used} limit={storage.limit} format={formatCloudResourceBytes} />
    </LimitCard>
    {chat.enabled ? <>
      <PermissionDetails label={t('permissionsQuotas.sendMedia')}>
        {Object.entries(chat.send).map(([kind, permission]) => <PermissionRow key={kind} permission={permission} label={t(chatSendLabels[kind as keyof typeof chatSendLabels])} />)}
        <PermissionRow permission={chat.download_voice} label={t('permissionsQuotas.downloadVoice')} />
      </PermissionDetails>
      <PermissionDetails label={t('permissionsQuotas.group')}>
        {Object.entries(chat.group).map(([key, permission]) => <PermissionRow key={key} permission={permission} label={t(chatGroupLabels[key as keyof typeof chatGroupLabels])} />)}
      </PermissionDetails>
    </> : <p className="permission-quota-note">{reasonLabel('space_disabled')}</p>}
  </>;
}

function SquareQuotas({ square }: { square: PersonalPermissionQuotaSnapshot['square'] }) {
  const { t, reasonLabel } = useQuotaLabels();
  const { quota, publish, comment, reply } = square;
  if (!quota) return <p className="permission-quota-disabled">{reasonLabel('space_disabled')}</p>;
  const statements = quota.statements;
  const statementRemaining = availableSquareQuota(statements.daily_used, statements.daily_limit, statements.weekly_used, statements.weekly_limit);
  const commentPermission = comment.allowed ? reply : comment;
  const buckets = [
    { key: 'statement', label: 'square.quotaStatements', quota: statements, permission: publish },
    { key: 'comment', label: 'square.quotaComments', quota: quota.comments, permission: comment.allowed || reply.allowed ? null : commentPermission },
  ] as const;
  const anonymousRemaining = statements.anonymous_weekly_limit === null ? statementRemaining :
    Math.min(statementRemaining ?? Infinity, Math.max(0, statements.anonymous_weekly_limit - statements.anonymous_weekly_used));
  const availableLabel = (remaining: number | null) => remaining === null ? t('square.quotaUnlimitedShort') : t('square.quotaRemaining', { count: remaining });

  return <>
    {buckets.map(({ key, label, quota: bucket, permission }) => {
      const reason = permission?.reason;
      return <LimitCard key={key} title={t(label)}
        value={!reason ? availableLabel(availableSquareQuota(bucket.daily_used, bucket.daily_limit, bucket.weekly_used, bucket.weekly_limit)) : undefined}
        status={reason ? reasonLabel(reason, permission?.required_level, permission?.until) : undefined}>
        <UsageBar label={t('square.quota24Hours')} used={bucket.daily_used} limit={bucket.daily_limit} />
        <UsageBar label={t('square.quota7Days')} used={bucket.weekly_used} limit={bucket.weekly_limit} />
      </LimitCard>;
    })}
    {statements.anonymous_available ? <LimitCard title={t('square.quotaAnonymous')} value={publish.allowed ? availableLabel(anonymousRemaining) : undefined}
      note={t('permissionsQuotas.anonymousHint')}>
      <UsageBar label={t('square.quota7Days')} used={statements.anonymous_weekly_used} limit={statements.anonymous_weekly_limit} />
    </LimitCard> : null}
    <PermissionDetails label={t('permissionsQuotas.squareActions')}>
      {Object.entries(square.media).map(([kind, permission]) => <PermissionRow key={kind} permission={permission} label={t(squareMediaLabels[kind as keyof typeof squareMediaLabels])} />)}
      <PermissionRow label={t('permissionsQuotas.comment')} permission={comment} />
      <PermissionRow label={t('square.reply')} permission={reply} />
      <PermissionRow label={t('square.quotaLikes')} permission={square.like} />
    </PermissionDetails>
  </>;
}

export function PermissionQuotaContent({ snapshot, refreshing, onRefresh }: {
  snapshot: PersonalPermissionQuotaSnapshot; refreshing: boolean; onRefresh: () => void;
}) {
  const { t, beijingTime, reasonLabel } = useQuotaLabels();
  const id = useId();
  const { account, chat, square, social, research } = snapshot;
  const showSocialUsage = !social.reason || social.reason === 'exhausted';
  const content = {
    chat: <ChatQuotas chat={chat} />,
    square: <SquareQuotas square={square} />,
    social: <LimitCard title={t('permissionsQuotas.socialTitle')}
      value={showSocialUsage ? t('square.quotaRemaining', { count: social.remaining }) : undefined}
      status={social.reason ? reasonLabel(social.reason) : undefined}
      note={t('permissionsQuotas.socialHint')}>
      {showSocialUsage ? <>
        <UsageBar label={t('permissionsQuotas.weeklyUsed')} used={social.used} limit={social.limit} />
        <p className="permission-quota-note">{t('permissionsQuotas.resetAt', { time: beijingTime(social.reset_at) })}</p>
      </> : null}
    </LimitCard>,
    research: <div className="permission-quota-card"><ul className="permission-quota-list">
      <PermissionRow label={t('research.create')} permission={research.create} />
    </ul></div>,
  };

  return <div className="permission-quotas">
    <div className="permission-quota-account">
      <div><strong>{account.space_name}</strong><span>{t('permissionsQuotas.currentSpace')} · LV{account.level}{account.vip ? ' · VIP' : ''}</span></div>
      <OverlayIconButton icon="refresh" onClick={onRefresh} disabled={refreshing} aria-label={t('permissionsQuotas.refresh')} />
    </div>
    <nav aria-label={t('menu.permissionsQuotas')}>
      {sections.map(section => <button key={section.key} type="button" onClick={() => document.getElementById(`${id}-${section.key}`)?.scrollIntoView({ block: 'start' })}>
        <Icon name={section.icon} />{t(section.label)}
      </button>)}
    </nav>
    {sections.map(section => <section className="permission-quota-section" key={section.key} id={`${id}-${section.key}`}>
      <h2><Icon name={section.icon} />{t(section.label)}</h2>
      {content[section.key]}
    </section>)}
  </div>;
}

export function PermissionQuotaDrawer({ open, onOpen, onClose, userId, spaceId }: {
  open: boolean; onOpen: () => void; onClose: () => void; userId?: number; spaceId?: number;
}) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<PersonalPermissionQuotaSnapshot>();
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision(current => current + 1);
  const scoped = snapshot?.account.user_id === userId && snapshot?.account.space_id === spaceId ? snapshot : undefined;

  useEffect(() => {
    if (!open || !userId || !spaceId) return;
    const controller = new AbortController();
    setRefreshing(true);
    setFailed(false);
    api.getPersonalPermissionQuotas(controller.signal, `${spaceId}:${userId}`).then(result => {
      if (controller.signal.aborted) return;
      if (result.account.user_id !== userId || result.account.space_id !== spaceId) setFailed(true);
      else setSnapshot(result);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setRefreshing(false); });
    return () => controller.abort();
  }, [open, revision, userId, spaceId]);

  return <SideDrawer className="permission-quota-drawer" historyKey="permissions-quotas" open={open} onRouteOpen={onOpen} onClose={onClose} title={t('menu.permissionsQuotas')} showTitle>
    {open ? <>
      {failed ? <QuietState icon="cloud_off" title={t('permissionsQuotas.loadFailed')} action={<button className="ghost-button" type="button" onClick={refresh}>{t('common.retry')}</button>} /> : null}
      {scoped ? <PermissionQuotaContent snapshot={scoped} refreshing={refreshing} onRefresh={refresh} />
        : !failed ? <ContentLoader label={t('common.loading')} rows={3} /> : null}
    </> : null}
  </SideDrawer>;
}
