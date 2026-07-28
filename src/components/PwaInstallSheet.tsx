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

interface PwaInstallSheetProps {
  open: boolean;
  spaceName: string;
  onClose: () => void;
  onInstalled?: () => void;
}

export function PwaInstallSheet({ open, spaceName, onClose, onInstalled }: PwaInstallSheetProps) {
  const ios = isIosDevice();
  const android = isAndroidDevice();
  const desktopChrome = isDesktopChrome();
  const detectedBrand = detectAndroidInstallBrand();
  const appName = `${spaceName} - 言浪`;
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

  const guide = {
    huawei: [
      ["打开浏览器菜单", "点击华为浏览器右下角的菜单按钮。"],
      ["选择“添加至”", "在菜单中选择“添加至”，再选择“桌面”。"],
      ["确认桌面入口", "部分机型会以快应用方式创建，这是正常现象。"],
    ],
    xiaomi: [
      ["打开浏览器菜单", "点击浏览器底部或右上角的菜单按钮。"],
      ["添加到主屏幕", "选择“安装应用”或“添加到主屏幕”。"],
      ["允许创建快捷方式", "若没有出现图标，请在系统设置中允许浏览器创建桌面快捷方式。"],
    ],
    oppo: [
      ["打开浏览器菜单", "点击浏览器底部菜单或工具箱。"],
      ["添加到桌面", "选择“添加到桌面”或“安装应用”。"],
      ["检查桌面权限", "若没有出现图标，请允许浏览器创建桌面快捷方式。"],
    ],
    other: [
      ["打开浏览器菜单", "点击浏览器右上角或底部的菜单按钮。"],
      ["找到安装入口", "选择“安装应用”或“添加到主屏幕”。"],
      ["确认添加", "完成后从手机桌面打开言浪。"],
    ],
  }[guideBrand];

  const brandName = {
    huawei: "华为 / 荣耀",
    xiaomi: "小米 / Redmi",
    oppo: "OPPO / 一加 / realme",
    other: "其他 Android 手机",
  }[guideBrand];
  const detectedBrandName = {
    huawei: "华为 / 荣耀",
    xiaomi: "小米 / Redmi",
    oppo: "OPPO / 一加 / realme",
    other: "Android",
  }[detectedBrand];

  return (
    <BottomSheet
      className="pwa-install-sheet"
      onClose={onClose}
      open={open}
      title={`安装 ${appName}`}
    >
      <div className="pwa-install-guide">
        {ios ? (
          <ol className="pwa-install-steps">
            <li><span>1</span><div><strong>点开分享</strong><p>点击 Safari 底部的分享按钮。</p></div></li>
            <li><span>2</span><div><strong>添加到主屏幕</strong><p>确认名称后点击“添加”。</p></div></li>
          </ol>
        ) : android && manualGuide ? (
          <div className="pwa-brand-install-guide">
            <div className="pwa-brand-install-heading">
              <span>适用于</span>
              <strong>{brandName}</strong>
            </div>
            <ol className="pwa-install-steps">
              {guide.map(([title, description], index) => (
                <li key={title}>
                  <span>{index + 1}</span>
                  <div><strong>{title}</strong><p>{description}</p></div>
                </li>
              ))}
            </ol>
            {guideBrand !== "other" ? (
              <button className="pwa-other-brand-button" onClick={() => setGuideBrand("other")} type="button">
                其他手机品牌
              </button>
            ) : detectedBrand !== "other" ? (
              <button className="pwa-other-brand-button" onClick={() => setGuideBrand(detectedBrand)} type="button">
                返回 {detectedBrandName}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="pwa-install-mark" aria-hidden="true">
              <span className="pwa-symbol">+</span>
            </div>
            <p className="pwa-install-note">独立窗口打开，并可接收系统通知。</p>
            <button className="primary-button pwa-install-button" onClick={() => void install()} type="button">
              安装到桌面
            </button>
            <p className="pwa-install-browser-hint">
              {desktopChrome && !promptAvailable
                ? "若没有弹出确认，请点击地址栏右侧的安装图标。"
                : "若未弹出确认，请使用浏览器菜单中的“安装应用”。"}
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
