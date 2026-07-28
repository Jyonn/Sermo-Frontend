import { useEffect, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  canPromptPwaInstall,
  isAndroidDevice,
  isDesktopChrome,
  isIosDevice,
  PWA_INSTALL_STATE_EVENT,
  requestPwaInstall,
} from "../lib/pwaInstall";

interface PwaInstallSheetProps {
  open: boolean;
  spaceName: string;
  onClose: () => void;
  onInstalled?: () => void;
}

export function PwaInstallSheet({ open, spaceName, onClose, onInstalled }: PwaInstallSheetProps) {
  const ios = isIosDevice();
  const desktopChrome = isDesktopChrome();
  const android = isAndroidDevice();
  const appName = `${spaceName} - 言浪`;
  const [promptAvailable, setPromptAvailable] = useState(canPromptPwaInstall());
  const [manualGuide, setManualGuide] = useState(false);

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
    if (open) setManualGuide(!canPromptPwaInstall());
  }, [open]);

  const install = async () => {
    const outcome = await requestPwaInstall();
    if (outcome === "accepted") {
      onInstalled?.();
      onClose();
    } else {
      setManualGuide(true);
      setPromptAvailable(false);
    }
  };

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
          <>
            <ol className="pwa-install-steps">
              <li><span>1</span><div><strong>打开浏览器菜单</strong><p>点击 Chrome 右上角的三个点。</p></div></li>
              <li><span>2</span><div><strong>安装应用</strong><p>选择“安装应用”或“添加到主屏幕”。</p></div></li>
              <li><span>3</span><div><strong>确认安装</strong><p>完成后会在手机桌面生成言浪入口。</p></div></li>
            </ol>
            <p className="pwa-install-browser-hint">若菜单中没有安装选项，请使用 Android Chrome 打开当前网址，并确认未处于无痕模式。</p>
          </>
        ) : (
          <>
            <div className="pwa-install-mark" aria-hidden="true">
              <span className="pwa-symbol">+</span>
            </div>
            <p className="pwa-install-note">独立窗口打开，并可接收系统通知。</p>
            {promptAvailable ? (
              <button className="primary-button pwa-install-button" onClick={() => void install()} type="button">
                唤起系统安装
              </button>
            ) : null}
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
