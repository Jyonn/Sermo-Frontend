import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "./ConfirmDialog";
import { ForwardArrowIcon } from "./ForwardArrowIcon";
import { useI18n } from "../lib/language";

interface VerificationBannerProps {
  verified: boolean;
  mode?: "tab" | "menu";
  onAction?: () => void;
  hasPassword?: boolean;
}

export function VerificationBanner({ verified, mode = "tab", onAction, hasPassword = true }: VerificationBannerProps) {
  const { t } = useI18n();
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
          <strong>{t("verification.email")}</strong>
          <span>{t("verification.unlock")}</span>
        </div>
        <ForwardArrowIcon className="verification-banner-action" />
      </button>
      <ConfirmDialog
        open={passwordReminderOpen}
        title={t("verification.passwordFirst")}
        description={t("verification.passwordHint")}
        confirmLabel={t("verification.goSet")}
        onClose={() => setPasswordReminderOpen(false)}
        onConfirm={() => {
          setPasswordReminderOpen(false);
          navigate("/app/menu?panel=account-security");
        }}
      />
    </>
  );
}
