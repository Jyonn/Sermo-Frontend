import { useI18n } from "../lib/language";
import { ComposerSvgIcon } from "./ComposerSvgIcon";
import "./ComposerMoreActions.css";

export function ComposerMoreActions({ open, disabled, footprintEnabled, footprintBusy, onFile, onFootprint }: {
  open: boolean; disabled: boolean; footprintEnabled: boolean; footprintBusy: boolean;
  onFile: () => void; onFootprint: () => void;
}) {
  const { t } = useI18n();
  return <div id="chat-composer-more" className={`composer-more-reveal${open ? " is-open" : ""}`} aria-hidden={!open}>
    <div className="composer-more-reveal-inner">
      <div className="composer-more-actions" role="group" aria-label={t("composer.moreActions")}>
        <button type="button" disabled={disabled || !open} tabIndex={open ? 0 : -1} onClick={onFile}><span><ComposerSvgIcon kind="file" /></span><strong>{t("media.file")}</strong></button>
        {footprintEnabled ? <button type="button" disabled={disabled || footprintBusy || !open} tabIndex={open ? 0 : -1} onClick={onFootprint}><span><ComposerSvgIcon kind="map" /></span><strong>{t("travelMap.actionShort")}</strong></button> : null}
      </div>
    </div>
  </div>;
}
