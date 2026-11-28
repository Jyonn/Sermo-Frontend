import {useEffect, useId, useRef, useState} from 'react';
import {useI18n} from '../lib/language';
import {useModalFocus} from '../lib/modalFocus';
import {OverlayIconButton} from './OverlayIconButton';

export function MediaShareMenu({share, download, forward, downloadLabel, disabled, suppressed = false}: {
  share?: () => void;
  download?: () => void;
  forward?: () => void;
  downloadLabel?: string;
  disabled?: boolean;
  suppressed?: boolean;
}) {
  const {t} = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const shown = open && !suppressed;
  useModalFocus(menu, shown, () => setOpen(false), {manageLayer: false});
  useEffect(() => {if (suppressed) setOpen(false);}, [suppressed]);

  useEffect(() => {
    if (!shown) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [shown]);

  const label = t('square.share');
  const actions = [
    {icon: 'ios_share', label, select: share},
    {icon: 'download', label: t('common.download'), detail: downloadLabel, select: download},
    {icon: 'forward', label: t('message.forward'), select: forward},
  ];
  return <div className="media-drawer-share" ref={root}>
    <OverlayIconButton icon="ios_share" aria-label={label} aria-haspopup="menu" aria-expanded={shown}
      aria-controls={shown ? id : undefined} disabled={disabled} onClick={() => setOpen(current => !current)} />
    {shown && <div className="media-drawer-share-menu" id={id} ref={menu} role="menu" aria-label={label}
      onKeyDown={event => {
        event.stopPropagation();
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = Array.from(menu.current?.querySelectorAll('button') ?? []);
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
        buttons[next]?.focus();
      }}>
      {actions.map(action => action.select && <button key={action.icon} type="button" role="menuitem" onClick={() => {
        setOpen(false);
        action.select?.();
      }}>
        <span className="material-symbols-outlined" aria-hidden="true">{action.icon}</span>
        <span>{action.label}</span>
        {action.detail && <small>{action.detail}</small>}
      </button>)}
    </div>}
  </div>;
}
