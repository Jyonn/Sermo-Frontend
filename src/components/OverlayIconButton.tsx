import type {ButtonHTMLAttributes} from 'react';
import {useI18n} from '../lib/language';
import './OverlayIconButton.css';

export function OverlayIconButton({icon, className = '', children, ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {icon?: string}) {
  return <button {...props} className={`overlay-icon-button ${className}`.trim()} type="button">
    {icon ? <span className="material-symbols-outlined" aria-hidden="true">{icon}</span> : children}
  </button>;
}

export function DrawerDismissButton({className = '', ...props}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>) {
  const {t} = useI18n();
  return <OverlayIconButton {...props} className={`drawer-dismiss-control ${className}`.trim()}>
    <span className="drawer-dismiss-mobile material-symbols-outlined" aria-hidden="true">arrow_back</span>
    <span className="drawer-dismiss-mobile drawer-control-label">{t('common.back')}</span>
    <span className="drawer-dismiss-desktop material-symbols-outlined" aria-hidden="true">close</span>
    <span className="drawer-dismiss-desktop drawer-control-label">{t('common.close')}</span>
  </OverlayIconButton>;
}
