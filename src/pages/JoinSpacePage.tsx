import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { clearPendingFriendInviteToken, readPendingFriendInviteToken } from "../lib/friendInvite";
import { getBrowserJoinLanguage, useI18n } from "../lib/language";
import { buildAdminEntryHref, buildAdminHrefForCurrentHost, buildAdminPath, buildHomeHrefForCurrentHost, getDetectedSpaceSlug, normalizeSlug } from "../lib/spaceEntry";
import type { SpaceDTO } from "../types";
import { showToast } from "../lib/toast";

const MAX_NICKNAME_LENGTH = 8;

function limitNickname(value: string) {
  return Array.from(value).slice(0, MAX_NICKNAME_LENGTH).join("");
}

function displaySlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function isPasswordRequiredJoinError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  return error.identifier === "USER@PASSWORD_REQUIRED";
}

export default function JoinSpacePage() {
  const { t } = useI18n();
  const { slug: routeSlug = "" } = useParams();
  const navigate = useNavigate();
  const { loginFromJoin, session } = useAuth();
  const detectedSlug = getDetectedSpaceSlug();
  const slug = useMemo(() => normalizeSlug(routeSlug || detectedSlug || ""), [detectedSlug, routeSlug]);
  const spaceDomainLabel = useMemo(() => {
    if (typeof window !== "undefined" && window.location.host) {
      return slug ? `${window.location.host}/${slug}` : window.location.host;
    }
    return slug ? `sermo.jyonn.space/${slug}` : "sermo.jyonn.space";
  }, [slug]);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceDTO | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "ready" | "missing" | "error">("loading");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<"channels" | "code" | "password">("channels");
  const [recoveryChannels, setRecoveryChannels] = useState<Array<{ channel: number; type: "email" | "sms"; masked: string }>>([]);
  const [recoveryTarget, setRecoveryTarget] = useState("");
  const [recoveryChallengeId, setRecoveryChallengeId] = useState<number | null>(null);
  const [recoveryResetToken, setRecoveryResetToken] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const pendingInviteToken = readPendingFriendInviteToken();
    if (pendingInviteToken) {
      navigate(`/friend-invite#token=${encodeURIComponent(pendingInviteToken)}`, { replace: true });
      return;
    }
    navigate("/app", { replace: true });
  }, [navigate, session]);

  useEffect(() => {
    if (!slug) navigate("/space", { replace: true });
  }, [navigate, slug]);

  useEffect(() => {
    if (!slug) return;

    const controller = new AbortController();
    setLookupState("loading");
    setSpace(null);
    setShowPasswordField(false);
    setPasswordHint(null);

    api
      .getSpaceBySlug(slug, controller.signal)
      .then((payload) => {
        setSpace(payload);
        setLookupState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        if (error instanceof ApiError && error.status === 404) {
          setLookupState("missing");
          return;
        }

        setLookupState("error");
      });

    return () => controller.abort();
  }, [slug]);

  const adminHref =
    typeof window !== "undefined" && window.location.hostname !== "localhost" ? buildAdminHrefForCurrentHost(slug) : buildAdminPath(slug, "login");

  const closeRecovery = () => {
    if (recoveryBusy) return;
    setRecoveryOpen(false);
    setRecoveryStep("channels");
    setRecoveryChannels([]);
    setRecoveryTarget("");
    setRecoveryChallengeId(null);
    setRecoveryResetToken("");
    setRecoveryCode("");
    setRecoveryPassword("");
    setRecoveryPasswordConfirm("");
    setRecoveryError(null);
  };

  const openRecovery = async () => {
    const name = nickname.trim();
    if (!name) {
      setPasswordHint(t("recovery.enterNickname"));
      return;
    }
    setRecoveryOpen(true);
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      const payload = await api.lookupPasswordRecovery({ slug, name });
      setRecoveryChannels(payload.channels);
      setRecoveryStep("channels");
    } catch (error) {
      setRecoveryError(error instanceof ApiError ? error.message : t("recovery.unavailable"));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const sendRecoveryCode = async (channel: number, masked: string) => {
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      const payload = await api.sendPasswordRecoveryCode({ slug, name: nickname.trim(), channel });
      setRecoveryChallengeId(payload.challenge_id);
      setRecoveryTarget(masked);
      setRecoveryStep("code");
    } catch (error) {
      setRecoveryError(error instanceof ApiError ? error.message : t("recovery.codeSendFailed"));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const verifyRecoveryCode = async () => {
    if (!recoveryChallengeId || recoveryCode.trim().length !== 6) return;
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      const payload = await api.verifyPasswordRecoveryCode({
        challenge_id: recoveryChallengeId,
        code: recoveryCode.trim(),
      });
      setRecoveryResetToken(payload.reset_token);
      setRecoveryStep("password");
    } catch (error) {
      setRecoveryError(error instanceof ApiError ? error.message : t("recovery.invalidCode"));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const resetRecoveredPassword = async () => {
    if (recoveryPassword.length < 6) {
      setRecoveryError(t("recovery.passwordMinimum"));
      return;
    }
    if (recoveryPassword !== recoveryPasswordConfirm) {
      setRecoveryError(t("recovery.passwordMismatch"));
      return;
    }
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      await api.resetRecoveredPassword({
        reset_token: recoveryResetToken,
        new_password: recoveryPassword,
      });
      const nextPassword = recoveryPassword;
      setRecoveryBusy(false);
      closeRecovery();
      setPassword(nextPassword);
      setShowPasswordField(true);
      setPasswordHint(t("recovery.resetHint"));
      showToast(t("recovery.resetDone"));
    } catch (error) {
      setRecoveryError(error instanceof ApiError ? error.message : t("recovery.resetFailed"));
      setRecoveryBusy(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nickname.trim()) {
      setSubmitError(t("join.enterNickname"));
      return;
    }
    if (Array.from(nickname.trim()).length > MAX_NICKNAME_LENGTH) {
      setSubmitError(t("join.nicknameTooLong", { count: MAX_NICKNAME_LENGTH }));
      return;
    }

    setSubmitError(null);
    setPasswordHint(null);
    setSubmitState("submitting");
    try {
      const payload = await api.joinSpace({
        slug,
        name: nickname.trim(),
        password: password.trim() || undefined,
        language: getBrowserJoinLanguage(),
      });
      loginFromJoin(payload);
      const pendingInviteToken = readPendingFriendInviteToken();
      if (pendingInviteToken) {
        navigate(`/friend-invite#token=${encodeURIComponent(pendingInviteToken)}`, { replace: true });
      } else {
        clearPendingFriendInviteToken();
        navigate("/app", { replace: true });
      }
    } catch (error) {
      if (isPasswordRequiredJoinError(error)) {
        setShowPasswordField(true);
        setPasswordHint(t("join.passwordRequired"));
        return;
      }

      const message = error instanceof ApiError ? error.message : t("join.failed");
      setSubmitError(message);
    } finally {
      setSubmitState("idle");
    }
  };

  return (
    <AppChrome
      guestSpaceBrand={{
        name: space?.name || displaySlug(slug) || slug,
        avatarUri: space?.official_user?.avatar_uri,
      }}
      hidePageTitle
      publicHeader
      title={space?.name || displaySlug(slug) || slug}
      topbarAction={
        <a className="ghost-chip" href={adminHref}>
          {t("join.adminLogin")}
        </a>
      }
    >
      <section className="auth-shell">
        <div className={`auth-card ${lookupState !== "ready" ? "is-space-state" : ""}`}>
          {lookupState === "loading" ? (
            <div className="join-space-state loading">
              <div className="join-space-state-icon is-loading" aria-hidden="true"><span /></div>
              <div className="join-space-state-copy">
                <h2>{t("join.checking")}</h2>
                <div className="join-space-domain">{spaceDomainLabel}</div>
              </div>
            </div>
          ) : null}

          {lookupState === "missing" ? (
            <div className="join-space-state missing">
              <div className="join-space-state-icon" aria-hidden="true"><span>404</span></div>
              <div className="join-space-state-copy">
                <h2>{t("join.missing")}</h2>
                <div className="join-space-domain">{spaceDomainLabel}</div>
                <p>{t("join.missingHint")}</p>
              </div>
              <div className="join-space-state-actions">
                <a className="button" href={buildHomeHrefForCurrentHost()}>
                  {t("join.about")}
                </a>
                <a className="ghost-button" href={buildAdminEntryHref("create", slug)}>
                  {t("join.createThis")}
                </a>
              </div>
            </div>
          ) : null}

          {lookupState === "error" ? (
            <div className="join-space-state error">
              <div className="join-space-state-icon" aria-hidden="true"><span>!</span></div>
              <div className="join-space-state-copy">
                <h2>{t("join.checkFailed")}</h2>
                <div className="join-space-domain">{spaceDomainLabel}</div>
                <p>{t("join.checkNetwork")}</p>
              </div>
              <div className="join-space-state-actions">
                <a className="button" href={buildHomeHrefForCurrentHost()}>
                  {t("join.about")}
                </a>
                <button
                  className="ghost-button"
                  onClick={() => {
                    window.location.reload();
                  }}
                  type="button"
                >
                  {t("join.retry")}
                </button>
              </div>
            </div>
          ) : null}

          {lookupState === "ready" ? (
            <form className="auth-form" onSubmit={(event) => void submit(event)}>
              <div className="join-space-head">
                <p className="join-space-kicker">{t("join.welcome", { name: space?.name || displaySlug(slug) })}</p>
                <h2>{t("join.nicknamePrompt")}</h2>
              </div>

              {space?.official_user ? (
                <div className="join-space-official-card">
                  <UserAvatar
                    className="avatar join-space-official-avatar"
                    name={space.official_user.name}
                    uri={space.official_user.avatar_uri}
                  />
                  <div className="join-space-official-copy">
                    <strong>{space.official_user.name}</strong>
                    <span>@{space.slug}</span>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="field-label">{t("join.nickname")}</label>
                <input
                  className="input"
                  maxLength={MAX_NICKNAME_LENGTH}
                  placeholder={t("join.nicknamePlaceholder")}
                  value={nickname}
                  onChange={(event) => {
                    setNickname(limitNickname(event.target.value));
                    setPasswordHint(null);
                  }}
                />
              </div>

              {!showPasswordField ? (
                <button className="ghost-button auth-toggle" onClick={() => setShowPasswordField(true)} type="button">
                  {t("join.hasPassword")}
                </button>
              ) : (
                <div>
                  <div className="auth-password-label">
                    <label className="field-label">{t("join.password")}</label>
                    <button className="auth-forgot-button" onClick={() => void openRecovery()} type="button">{t("join.forgotPassword")}</button>
                  </div>
                  <input
                    autoFocus
                    className="input"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setPasswordHint(null);
                    }}
                  />
                  {passwordHint ? <p className="field-hint field-hint-subtle">{passwordHint}</p> : null}
                </div>
              )}

              <button className="button auth-submit" disabled={submitState === "submitting"} type="submit">
                {submitState === "submitting" ? t("join.entering") : t("join.enter")}
              </button>
            </form>
          ) : null}
        </div>
      </section>
      <AsyncErrorDialog message={submitError ?? ""} onClose={() => setSubmitError(null)} open={Boolean(submitError)} />
      <BottomSheet open={recoveryOpen} onClose={closeRecovery} title={t("recovery.title")}>
        <div className="password-recovery">
          {recoveryBusy && recoveryStep === "channels" && !recoveryChannels.length ? (
            <div className="password-recovery-loading"><span className="material-symbols-outlined">progress_activity</span>{t("recovery.finding")}</div>
          ) : null}

          {recoveryStep === "channels" && recoveryChannels.length ? (
            <>
              <div className="password-recovery-account">
                <span>{nickname.trim()}</span>
                <small>@{space?.slug}</small>
              </div>
              <div className="simple-list">
                {recoveryChannels.map((item) => (
                  <button className="simple-row password-recovery-channel" disabled={recoveryBusy} key={item.channel} onClick={() => void sendRecoveryCode(item.channel, item.masked)} type="button">
                    <span className="password-recovery-channel-icon" aria-hidden="true">
                      {item.type === "email" ? (
                        <svg fill="none" viewBox="0 0 24 24">
                          <path d="M4.5 7.5 12 13l7.5-5.5M6 5.5h12A2.5 2.5 0 0 1 20.5 8v8A2.5 2.5 0 0 1 18 18.5H6A2.5 2.5 0 0 1 3.5 16V8A2.5 2.5 0 0 1 6 5.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      ) : (
                        <svg fill="none" viewBox="0 0 24 24">
                          <rect height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="12" x="6" y="2.5" />
                          <path d="M10 5h4M10.5 18.5h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                        </svg>
                      )}
                    </span>
                    <span className="row-main">
                      <strong>{item.type === "email" ? t("recovery.viaEmail") : t("recovery.viaPhone")}</strong>
                      <span className="row-subtle">{item.masked}</span>
                    </span>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {recoveryStep === "code" ? (
            <div className="simple-form">
              <div className="password-recovery-target">{t("recovery.codeSentTo")} <strong>{recoveryTarget}</strong></div>
              <label className="field-label">{t("recovery.code")}</label>
              <VerificationCodeInput ariaLabel={t("recovery.code")} autoFocus value={recoveryCode} onChange={setRecoveryCode} />
              <button className="button" disabled={recoveryBusy || recoveryCode.length !== 6} onClick={() => void verifyRecoveryCode()} type="button">
                {recoveryBusy ? t("recovery.verifying") : t("common.continue")}
              </button>
            </div>
          ) : null}

          {recoveryStep === "password" ? (
            <div className="simple-form">
              <label className="field-label">{t("recovery.newPassword")}</label>
              <input autoFocus className="input" type="password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} />
              <label className="field-label">{t("recovery.confirmPassword")}</label>
              <input className="input" type="password" value={recoveryPasswordConfirm} onChange={(event) => setRecoveryPasswordConfirm(event.target.value)} />
              <button className="button" disabled={recoveryBusy || !recoveryPassword || !recoveryPasswordConfirm} onClick={() => void resetRecoveredPassword()} type="button">
                {recoveryBusy ? t("recovery.resetting") : t("recovery.resetPassword")}
              </button>
            </div>
          ) : null}

          {recoveryError ? <div className="field-hint password-recovery-error">{recoveryError}</div> : null}
        </div>
      </BottomSheet>
    </AppChrome>
  );
}
