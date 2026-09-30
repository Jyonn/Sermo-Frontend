import { useTranslation } from "react-i18next";
import { CURRENT_RELEASE } from "../lib/pwaUpdate";
import { needsContentUpgrade } from "../lib/contentCompatibility";

export function UnsupportedContentNotice({ minVersion, title, url }: { minVersion?: string; title?: string; url?: string }) {
  const { t } = useTranslation();
  const needsUpgrade = needsContentUpgrade(minVersion, CURRENT_RELEASE.id);
  const safeUrl = url && /^https?:\/\//i.test(url) ? url : undefined;

  return (
    <div className="unsupported-content-notice">
      <span className="material-symbols-outlined" aria-hidden="true">system_update</span>
      <div className="unsupported-content-copy">
        {title ? <strong>{title}</strong> : null}
        <span>{needsUpgrade ? t("content.upgradeToPreview", { version: minVersion }) : t("content.updateToPreview")}</span>
        {safeUrl ? <a href={safeUrl} onClick={(event) => event.stopPropagation()} rel="noreferrer" target="_blank">{t("content.openOriginal")}</a> : null}
      </div>
    </div>
  );
}
