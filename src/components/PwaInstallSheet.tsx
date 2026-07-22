import { BottomSheet } from "./BottomSheet";
import { isIosDevice, requestPwaInstall } from "../lib/pwaInstall";

interface PwaInstallSheetProps {
  open: boolean;
  spaceName: string;
  onClose: () => void;
}

export function PwaInstallSheet({ open, spaceName, onClose }: PwaInstallSheetProps) {
  const ios = isIosDevice();

  const install = async () => {
    const outcome = await requestPwaInstall();
    if (outcome === "accepted") onClose();
  };

  return (
    <BottomSheet
      className="pwa-install-sheet"
      description="像 App 一样打开，消息触手可及。"
      onClose={onClose}
      open={open}
      title={`安装 ${spaceName}`}
    >
      <div className="pwa-install-guide">
        {ios ? (
          <ol className="pwa-install-steps">
            <li><span>1</span><div><strong>点开分享</strong><p>点击 Safari 底部的分享按钮。</p></div></li>
            <li><span>2</span><div><strong>添加到主屏幕</strong><p>确认名称后点击“添加”。</p></div></li>
          </ol>
        ) : (
          <>
            <div className="pwa-install-mark" aria-hidden="true">
              <span className="pwa-symbol">+</span>
            </div>
            <p className="pwa-install-note">独立窗口打开，并可接收系统通知。</p>
            <button className="primary-button pwa-install-button" onClick={() => void install()} type="button">
              安装到桌面
            </button>
            <p className="pwa-install-browser-hint">若未弹出确认，请使用浏览器菜单中的“安装应用”。</p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
