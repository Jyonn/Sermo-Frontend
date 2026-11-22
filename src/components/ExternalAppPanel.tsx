import type {ReactNode} from 'react';
import {useI18n} from '../lib/language';
import './ExternalAppPanel.css';

export type AppConnectionState = 'connected' | 'disconnected' | 'unavailable';

export function ExternalAppIdentity({logo, title, description, connection}: {
  logo: string;
  title: string;
  description: string;
  connection?: AppConnectionState;
}) {
  const {t} = useI18n();
  return <header className="external-app-identity">
    <img src={logo} alt="" width={44} height={44} />
    <div className="external-app-copy">
      <div className="external-app-heading">
        <h2>{title}</h2>
        {connection && <span className="external-app-status" data-connection={connection}>
          {t(connection === 'connected' ? 'pocklo.statusConnected' : connection === 'unavailable' ? 'pocklo.statusUnavailable' : 'pocklo.statusDisconnected')}
        </span>}
      </div>
      <p>{description}</p>
    </div>
  </header>;
}

export function ExternalAppActions({children}: {children: ReactNode}) {
  return <div className="external-app-actions">{children}</div>;
}

type ExternalAppActionProps = {icon: string; label: string; description?: string} & (
  {href: string; onClick?: never; disabled?: never} |
  {href?: never; onClick: () => void; disabled?: boolean}
);

export function ExternalAppAction({icon, label, description, href, onClick, disabled}: ExternalAppActionProps) {
  const content = <>
    <span className="external-app-action-icon material-symbols-outlined" aria-hidden="true">{icon}</span>
    <span className="external-app-action-copy"><strong>{label}</strong>{description && <small>{description}</small>}</span>
    <span className="external-app-action-trailing material-symbols-outlined" aria-hidden="true">{href ? 'north_east' : 'chevron_right'}</span>
  </>;
  return href
    ? <a className="external-app-action" href={href} target="_blank" rel="noopener noreferrer">{content}</a>
    : <button className="external-app-action" type="button" onClick={onClick} disabled={disabled}>{content}</button>;
}
