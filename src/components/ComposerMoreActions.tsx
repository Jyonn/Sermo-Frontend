import { useI18n } from "../lib/language";
import { ComposerSvgIcon } from "./ComposerSvgIcon";
import {ChatActionIcon} from './ChatActionIcon';
import stillfolioMark from "../assets/stillfolio-mark.svg";
import {DROP_ICON} from '../lib/dropPicker';

export function ComposerMoreActions({ open, disabled, footprintEnabled, footprintBusy, onFile, onStillfolio, onDrop, onFootprint, onCall, compact, onToggleLayout }: {
  open: boolean; disabled: boolean; footprintEnabled: boolean; footprintBusy: boolean;
  onFile: () => void; onFootprint: () => void;
  onStillfolio?: () => void;
  onDrop?:()=>void;
  onCall?: () => void;
  compact?: boolean; onToggleLayout?: () => void;
}) {
  const { t } = useI18n();
  return <div id="chat-composer-more" className={`composer-more-reveal${open ? " is-open" : ""}`} aria-hidden={!open}>
    <div className="composer-more-reveal-inner">
      <div className="composer-more-actions" role="group" aria-label={t("composer.moreActions")}>
        {onDrop?<button type="button" disabled={disabled||!open} tabIndex={open?0:-1} onClick={onDrop} aria-label={t('drop.choose')}><span><img src={DROP_ICON} alt="" width={26} height={26}/></span><strong>{t('drop.shortName')}</strong></button>:null}
        <button type="button" disabled={disabled || !open} tabIndex={open ? 0 : -1} onClick={onFile}><span><ComposerSvgIcon kind="file" /></span><strong>{t("media.file")}</strong></button>
        {onCall ? <button type="button" disabled={disabled || !open} tabIndex={open ? 0 : -1} onClick={onCall}><span><ChatActionIcon action="call"/></span><strong>{t('voice.title')}</strong></button>:null}
        {onStillfolio && <button type="button" disabled={disabled || !open} tabIndex={open ? 0 : -1} onClick={onStillfolio}
          aria-label={t("apps.pickStillfolio")} title={t("apps.pickStillfolioHint")}><span><img src={stillfolioMark} alt="" width={22} height={22} /></span><strong>{t("stillfolio.shortName")}</strong></button>}
        {footprintEnabled ? <button type="button" disabled={disabled || footprintBusy || !open} tabIndex={open ? 0 : -1} onClick={onFootprint}><span><ComposerSvgIcon kind="map" /></span><strong>{t("travelMap.actionShort")}</strong></button> : null}
        {onToggleLayout ? <button type="button" disabled={disabled || !open} tabIndex={open ? 0 : -1} onClick={onToggleLayout}><span><ComposerSvgIcon kind={compact ? "expand" : "collapse"} /></span><strong>{t(compact ? "composer.expandLayout" : "composer.collapseLayout")}</strong></button> : null}
      </div>
    </div>
  </div>;
}
