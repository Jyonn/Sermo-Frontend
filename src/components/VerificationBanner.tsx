import { Link } from "react-router-dom";

interface VerificationBannerProps {
  verified: boolean;
  mode?: "tab" | "menu";
  onAction?: () => void;
}

export function VerificationBanner({ verified, mode = "tab", onAction }: VerificationBannerProps) {
  if (verified) {
    if (mode !== "menu") return null;
    return (
      <div className="verification-banner is-verified">
        <div className="verification-banner-copy">
          <strong>邮箱已认证</strong>
          <span>你已解锁发送好友申请、创建群聊等功能。</span>
        </div>
      </div>
    );
  }

  return (
    <div className="verification-banner">
      <div className="verification-banner-copy">
        <strong>认证邮箱，解锁更多功能</strong>
        <span>完成邮箱认证后即可发送好友申请、创建群聊并邀请成员。</span>
      </div>
      {onAction ? (
        <button className="ghost-button verification-banner-action" onClick={onAction} type="button">
          去认证
        </button>
      ) : (
        <Link className="ghost-button verification-banner-action" to="/app/settings/contacts?channel=email">
          去认证
        </Link>
      )}
    </div>
  );
}
