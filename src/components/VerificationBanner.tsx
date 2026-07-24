import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "./ConfirmDialog";

interface VerificationBannerProps {
  verified: boolean;
  mode?: "tab" | "menu";
  onAction?: () => void;
  hasPassword?: boolean;
}

export function VerificationBanner({ verified, mode = "tab", onAction, hasPassword = true }: VerificationBannerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [passwordReminderOpen, setPasswordReminderOpen] = useState(false);

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

  const handleAction = () => {
    if (!hasPassword) {
      setPasswordReminderOpen(true);
      return;
    }
    if (onAction) {
      onAction();
      return;
    }
    navigate("/app/menu?sheet=email-verification", {
      state: {
        emailVerificationReturnTo: `${location.pathname}${location.search}`,
      },
    });
  };

  return (
    <>
      <div className="verification-banner">
        <div className="verification-banner-copy">
          <strong>认证邮箱，解锁更多功能</strong>
          <span>完成邮箱认证后即可发送好友申请、创建群聊并邀请成员。</span>
        </div>
        <button className="ghost-button verification-banner-action" onClick={handleAction} type="button">
          去认证
        </button>
      </div>
      <ConfirmDialog
        open={passwordReminderOpen}
        title="请先设置密码"
        description="设置密码后，才能继续认证邮箱并完成后续绑定。"
        confirmLabel="去设置"
        onClose={() => setPasswordReminderOpen(false)}
        onConfirm={() => {
          setPasswordReminderOpen(false);
          navigate("/app/menu?drawer=security");
        }}
      />
    </>
  );
}
