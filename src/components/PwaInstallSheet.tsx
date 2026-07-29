import { useEffect, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  canPromptPwaInstall,
  detectAndroidInstallBrand,
  isAndroidDevice,
  isDesktopChrome,
  isIosDevice,
  PWA_INSTALL_STATE_EVENT,
  requestPwaInstall,
} from "../lib/pwaInstall";
import type { AndroidInstallBrand } from "../lib/pwaInstall";
import { useI18n, type TranslationKey } from "../lib/language";

interface PwaInstallSheetProps {
  open: boolean;
  spaceName: string;
  onClose: () => void;
  onInstalled?: () => void;
}

export function PwaInstallSheet({ open, spaceName, onClose, onInstalled }: PwaInstallSheetProps) {
  const { t } = useI18n();
  const ios = isIosDevice();
  const android = isAndroidDevice();
  const desktopChrome = isDesktopChrome();
  const detectedBrand = detectAndroidInstallBrand();
  const appName = `${spaceName} - ${t("brand.yanlang")}`;
  const [promptAvailable, setPromptAvailable] = useState(canPromptPwaInstall());
  const [manualGuide, setManualGuide] = useState(false);
  const [guideBrand, setGuideBrand] = useState<AndroidInstallBrand>(detectedBrand);

  useEffect(() => {
    const sync = () => {
      const available = canPromptPwaInstall();
      setPromptAvailable(available);
      if (available) setManualGuide(false);
    };
    window.addEventListener(PWA_INSTALL_STATE_EVENT, sync);
    return () => window.removeEventListener(PWA_INSTALL_STATE_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const available = canPromptPwaInstall();
    setPromptAvailable(available);
    setManualGuide(android && !available);
    setGuideBrand(detectedBrand);
  }, [android, detectedBrand, open]);

  const install = async () => {
    const outcome = await requestPwaInstall();
    if (outcome === "accepted") {
      onInstalled?.();
      onClose();
    } else if (outcome === "unavailable") {
      setManualGuide(true);
    }
  };

  const guideKeys = {
    huawei: [
      ["pwa.guideHuawei1", "pwa.guideHuawei1Hint"],
      ["pwa.guideHuawei2", "pwa.guideHuawei2Hint"],
      ["pwa.guideHuawei3", "pwa.guideHuawei3Hint"],
    ],
    xiaomi: [
      ["pwa.guideXiaomi1", "pwa.guideXiaomi1Hint"],
      ["pwa.guideXiaomi2", "pwa.guideXiaomi2Hint"],
      ["pwa.guideXiaomi3", "pwa.guideXiaomi3Hint"],
    ],
    oppo: [
      ["pwa.guideOppo1", "pwa.guideOppo1Hint"],
      ["pwa.guideOppo2", "pwa.guideOppo2Hint"],
      ["pwa.guideOppo3", "pwa.guideOppo3Hint"],
    ],
    other: [
      ["pwa.guideOther1", "pwa.guideOther1Hint"],
      ["pwa.guideOther2", "pwa.guideOther2Hint"],
      ["pwa.guideOther3", "pwa.guideOther3Hint"],
    ],
  }[guideBrand] as Array<[TranslationKey, TranslationKey]>;

  const brandName = {
    huawei: t("pwa.brandHuawei"),
    xiaomi: t("pwa.brandXiaomi"),
    oppo: t("pwa.brandOppo"),
    other: t("pwa.brandOther"),
  }[guideBrand];
  const detectedBrandName = {
    huawei: t("pwa.brandHuawei"),
    xiaomi: t("pwa.brandXiaomi"),
    oppo: t("pwa.brandOppo"),
    other: t("pwa.brandAndroid"),
  }[detectedBrand];

  return (
    <BottomSheet
      className="pwa-install-sheet"
      onClose={onClose}
      open={open}
      title={t("pwa.installTitle", { name: appName })}
    >
      <div className="pwa-install-guide">
        {ios ? (
          <ol className="pwa-install-steps">
            <li><span>1</span><div><strong>{t("pwa.iosShare")}</strong><p>{t("pwa.iosShareHint")}</p></div></li>
            <li><span>2</span><div><strong>{t("pwa.iosHome")}</strong><p>{t("pwa.iosHomeHint")}</p></div></li>
          </ol>
        ) : android && manualGuide ? (
          <div className="pwa-brand-install-guide">
            <div className="pwa-brand-install-heading">
              <span>{t("pwa.appliesTo")}</span>
              <strong>{brandName}</strong>
            </div>
            <ol className="pwa-install-steps">
              {guideKeys.map(([titleKey, descriptionKey], index) => (
                <li key={titleKey}>
                  <span>{index + 1}</span>
                  <div><strong>{t(titleKey)}</strong><p>{t(descriptionKey)}</p></div>
                </li>
              ))}
            </ol>
            {guideBrand !== "other" ? (
              <button className="pwa-other-brand-button" onClick={() => setGuideBrand("other")} type="button">
                {t("pwa.otherBrand")}
              </button>
            ) : detectedBrand !== "other" ? (
              <button className="pwa-other-brand-button" onClick={() => setGuideBrand(detectedBrand)} type="button">
                {t("pwa.backBrand", { brand: detectedBrandName })}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="pwa-install-mark" aria-hidden="true">
              <span className="pwa-symbol">+</span>
            </div>
            <p className="pwa-install-note">{t("pwa.standaloneHint")}</p>
            <button className="primary-button pwa-install-button" onClick={() => void install()} type="button">
              {t("pwa.installDesktop")}
            </button>
            <p className="pwa-install-browser-hint">
              {desktopChrome && !promptAvailable
                ? t("pwa.chromeHint")
                : t("pwa.browserHint")}
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
