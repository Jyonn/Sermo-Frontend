import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { FeedbackState } from "../components/FeedbackState";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { clearPendingFriendInviteToken, storePendingFriendInviteToken } from "../lib/friendInvite";
import { useAuth } from "../lib/auth";
import type { FriendInvitePreviewDTO } from "../types";
import { getActiveLocale, i18n, useI18n } from "../lib/language";

function readInviteToken() {
  if (typeof window === "undefined") return "";
  const search = new URLSearchParams(window.location.search);
  const searchToken = (search.get("token") || "").trim();
  if (searchToken) return searchToken;
  const hash = window.location.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hash);
  return (hashParams.get("token") || "").trim();
}

function formatExpire(value?: number) {
  if (!value) return "";
  return new Date(value * 1000).toLocaleString(getActiveLocale(), {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inviteValidityLabel(preview: FriendInvitePreviewDTO) {
  if (preview.permanent) return i18n.t("invite.permanent");
  return preview.expire ? i18n.t("invite.expires", { date: formatExpire(preview.expire) }) : "";
}

interface FriendInvitePageProps {
  overlay?: boolean;
}

export default function FriendInvitePage({ overlay = false }: FriendInvitePageProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [preview, setPreview] = useState<FriendInvitePreviewDTO | null>(null);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">("loading");
  const [redeemState, setRedeemState] = useState<"idle" | "loading" | "success">("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const token = useMemo(() => readInviteToken(), []);

  const closeOverlay = () => {
    navigate("/app", { replace: true });
  };

  useEffect(() => {
    if (!token) {
      setPreviewState("error");
      setPreviewError(t("invite.incomplete"));
      return;
    }

    const controller = new AbortController();
    setPreviewState("loading");
    setPreviewError(null);

    api
      .getFriendInvitePreview(token, controller.signal)
      .then((payload) => {
        setPreview(payload);
        setPreviewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        setPreviewState("error");
        setPreviewError(apiError instanceof ApiError ? apiError.message : t("invite.readFailed"));
      });

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (!session) {
      storePendingFriendInviteToken(token);
      return;
    }
  }, [session, token]);

  const redeemInvite = async () => {
    if (!token) return;
    setRedeemState("loading");
    setDialogError(null);
    try {
      await api.redeemFriendInviteToken(token);
      clearPendingFriendInviteToken();
      setRedeemState("success");
      window.setTimeout(() => {
        navigate("/app/friends/requests", { replace: true });
      }, 900);
    } catch (apiError) {
      setRedeemState("idle");
      setDialogError(apiError instanceof ApiError ? apiError.message : t("invite.handleFailed"));
    }
  };

  const readyCard =
    previewState === "ready" && preview ? (
      <section className={`panel friend-invite-card${overlay ? " is-overlay" : ""}`}>
        <p className="eyebrow">{t("invite.eyebrow")}</p>
        <div className="friend-invite-header">
          <UserAvatar className="avatar-large" name={preview.inviter.name} uri={preview.inviter.avatar_uri} />
          <div className="friend-invite-copy">
            <h2>{preview.inviter.name}</h2>
            <p>
              {t("invite.from")} <span className="friend-invite-space-handle">@{preview.space.name}</span>
            </p>
          </div>
        </div>

        <div className="friend-invite-body">
          <div className="friend-invite-space-row">
            <span>{t("invite.space")}</span>
            <strong>{preview.space.name}</strong>
          </div>
          {inviteValidityLabel(preview) ? <div className="count-badge">{inviteValidityLabel(preview)}</div> : null}
        </div>

        {!session ? (
          <div className="friend-invite-actions">
            <Link className="button" to="/">
              {t("invite.login")}
            </Link>
            <div className="detail-text">{t("invite.loginHint")}</div>
          </div>
        ) : (
          <div className="friend-invite-actions">
            <button className="button" disabled={redeemState === "loading" || redeemState === "success"} onClick={() => void redeemInvite()} type="button">
              {redeemState === "loading" ? t("invite.sending") : redeemState === "success" ? t("invite.sent") : t("invite.send")}
            </button>
            <div className="detail-text">{t("invite.qrHint")}</div>
          </div>
        )}
      </section>
    ) : null;

  const content = (
    <>
      {previewState === "loading" ? <FeedbackState title={t("invite.reading")} description="" tone="loading" /> : null}
      {readyCard}
      {previewState === "error" ? <FeedbackState title={t("invite.unavailable")} description={previewError ?? t("invite.expired")} tone="error" /> : null}
      <AsyncErrorDialog message={dialogError ?? ""} onClose={() => setDialogError(null)} open={Boolean(dialogError)} />
    </>
  );

  if (overlay && session) {
    return (
      <div className="dialog-backdrop friend-invite-backdrop" onClick={closeOverlay} role="presentation">
        <section aria-modal="true" className="friend-invite-modal" onClick={(event) => event.stopPropagation()} role="dialog">
          {content}
        </section>
      </div>
    );
  }

  return (
    <AppChrome hideMobileNav title={t("invite.title")}>
      <section className="auth-shell friend-invite-shell">
        <div className="auth-card is-space-state">{content}</div>
      </section>
    </AppChrome>
  );
}
