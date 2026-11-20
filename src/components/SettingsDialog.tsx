import {useId, useRef, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useBodyScrollLock} from '../lib/bodyLock';
import {useI18n} from '../lib/language';
import {useModalFocus} from '../lib/modalFocus';
import {OverlayScope} from '../lib/overlayLayer';
import './SelectControl.css';

export function SettingsDialog({open, title, onClose, children}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const {t} = useI18n();
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  useBodyScrollLock(open);
  useModalFocus(root, open, onClose);
  return <OverlayScope root={root}>{open && typeof document !== 'undefined' && createPortal(
    <div className="dialog-backdrop option-picker-backdrop settings-dialog-backdrop" role="presentation" onClick={onClose}>
      <section ref={root} tabIndex={-1} className="option-picker-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
        <header><h2 id={titleId}>{title}</h2><button type="button" className="option-picker-close" aria-label={t('common.close')} onClick={onClose}><span className="material-symbols-outlined" aria-hidden="true">close</span></button></header>
        <div className="settings-dialog-body">{children}</div>
      </section>
    </div>, document.body
  )}</OverlayScope>;
}
