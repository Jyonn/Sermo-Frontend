import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "./ConfirmDialog";
import { ForwardArrowIcon } from "./ForwardArrowIcon";

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

  if (verified) return null;

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
      <button className={`verification-banner${mode === "menu" ? " is-menu" : ""}`} onClick={handleAction} type="button">
        <div className="verification-banner-copy">
          <strong>认证邮箱</strong>
          <span>解锁好友与群聊</span>
        </div>
        <ForwardArrowIcon className="verification-banner-action" />
      </button>
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
