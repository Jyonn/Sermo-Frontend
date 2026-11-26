import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { duelLoginReturn } from "../lib/numberDuel";
import { AppChrome } from "../components/AppChrome";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SpaceAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { clearPendingFriendInviteToken, readPendingFriendInviteToken } from "../lib/friendInvite";
import { getBrowserJoinLanguage, useI18n } from "../lib/language";
import { buildHomeHrefForCurrentHost, getDetectedSpaceSlug, normalizeSlug } from "../lib/spaceEntry";
import type { JoinResponseDTO, SpaceDTO, SpaceJoinReceipt } from "../types";
import { showToast } from "../lib/toast";
import { PUBLIC_HOST } from "../lib/siteConfig";
import { isOAuthLoginPending, completeOAuthLogin, readOAuthRequest, oauthReturnForAccount } from "../lib/oauthPending";
import "./SpaceAdmission.css";

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

interface JoinSpacePageProps {
  embedded?: boolean;
  spaceSlug?: string;
  onJoined?: (payload: JoinResponseDTO) => void;
  onBusyChange?: (busy: boolean) => void;
}

export default function JoinSpacePage({ embedded = false, spaceSlug, onJoined, onBusyChange }: JoinSpacePageProps = {}) {
  const { t } = useI18n();
  const { slug: routeSlug = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const loginReturn = duelLoginReturn(location.state?.from);
  const { loginFromJoin, session } = useAuth();
  const detectedSlug = getDetectedSpaceSlug();
  const slug = useMemo(() => normalizeSlug(spaceSlug || routeSlug || detectedSlug || ""), [detectedSlug, routeSlug, spaceSlug]);
  const alive = useRef(true);
  const spaceDomainLabel = useMemo(() => {
    if (typeof window !== "undefined" && window.location.host) {
      return slug ? `${window.location.host}/${slug}` : window.location.host;
    }
    return slug ? `${PUBLIC_HOST}/${slug}` : PUBLIC_HOST;
  }, [slug]);
  const [nickname, setNickname] = useState("");
  const nicknameComposingRef = useRef(false);
  const [password, setPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceDTO | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "ready" | "missing" | "error">("loading");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");
  const [pendingNewUserName, setPendingNewUserName] = useState<string | null>(null);
  const [application, setApplication] = useState<SpaceJoinReceipt | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [admissionError, setAdmissionError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [applicationNote, setApplicationNote] = useState("");
  const receiptRef = useRef<{ slug: string; value: string } | null>(null);
  const receiptKey = `frienden:space-join-receipt:${slug}`;
  const joinMode = space?.join_mode ?? "open";
  const approvedForName = application?.status === "approved" && application.name.toLowerCase() === pendingNewUserName?.toLowerCase();
  const requestingApproval = joinMode === "approval" && !approvedForName;
  const waitingForApplication = requestingApproval && (application?.status === "pending" || application?.status === "approved");
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

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    onBusyChange?.(submitState === "submitting" || recoveryBusy);
    return () => onBusyChange?.(false);
  }, [submitState, recoveryBusy, onBusyChange]);

  useEffect(() => {
    if (embedded || !session || isOAuthLoginPending()) return;
    const pendingInviteToken = readPendingFriendInviteToken();
    if (pendingInviteToken) {
      navigate(`/friend-invite#token=${encodeURIComponent(pendingInviteToken)}`, { replace: true });
      return;
    }
    navigate(loginReturn, { replace: true });
  }, [embedded, navigate, session, loginReturn]);

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

  useEffect(() => {
    receiptRef.current = null;
    setApplication(null);
    setApplicationError("");
    setApplicationLoading(false);
    setPendingNewUserName(null);
    setAdmissionError("");
    setNewPassword("");
    setJoinCode("");
    setApplicationNote("");
    let receipt: string | null = null;
    try { receipt = localStorage.getItem(receiptKey); }
    catch { /* This browser may limit persistent storage. */ }
    if (!receipt || !slug) return;
    receiptRef.current = { slug, value: receipt };
    const controller = new AbortController();
    void refreshApplication(false, controller.signal);
    return () => controller.abort();
  }, [slug, receiptKey]);

  function clearReceipt() {
    receiptRef.current = null;
    try { localStorage.removeItem(receiptKey); }
    catch { /* Receipt can still be cleared in memory. */ }
  }

  async function refreshApplication(showError = true, signal?: AbortSignal) {
    const receipt = receiptRef.current;
    if (!receipt || receipt.slug !== slug) return;
    setApplicationError("");
    setApplicationLoading(true);
    try {
      const next = await api.getSpaceJoinApplication(slug, receipt.value, signal);
      if (!signal?.aborted && receiptRef.current === receipt) {
        setApplication(next.status === "joined" ? null : next);
        if (next.status === "joined") clearReceipt();
      }
    } catch (e) {
      if (showError && !signal?.aborted && receiptRef.current === receipt) {
        setApplicationError(e instanceof Error ? e.message : t("join.failed"));
      }
    } finally {
      if (!signal?.aborted) setApplicationLoading(false);
    }
  }

  async function requestApproval(name: string) {
    if (submitState === "submitting" || waitingForApplication) return;
    setAdmissionError("");
    setSubmitState("submitting");
    let receipt = receiptRef.current;
    if (!receipt || receipt.slug !== slug || application?.status === "rejected") {
      const value = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
      receipt = { slug, value };
      receiptRef.current = receipt;
      try { localStorage.setItem(receiptKey, value); }
      catch { /* Keep the receipt available in the current page. */ }
    }
    try {
      const next = await api.applyToSpace({ slug, name, note: applicationNote.trim(), receipt: receipt.value });
      if (alive.current && receiptRef.current === receipt) {
        setApplication(next);
        setPendingNewUserName(null);
        setApplicationNote("");
      }
    } catch (error) {
      if (alive.current && receiptRef.current === receipt) setAdmissionError(error instanceof Error ? error.message : t("join.failed"));
    } finally { setSubmitState("idle"); }
  }

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

  const attemptJoin = async (name: string, newUserIntent: "check" | "create") => {
    if (submitState === "submitting") return;
    setSubmitError(null);
    setPasswordHint(null);
    setAdmissionError("");
    setSubmitState("submitting");
    try {
      const payload = await api.joinSpace({
        slug,
        name,
        password: (newUserIntent === "create" && joinMode !== "open" ? newPassword : password).trim() || undefined,
        language: getBrowserJoinLanguage(),
        new_user_intent: newUserIntent,
        invite_code: newUserIntent === "create" && joinMode === "invite" ? joinCode.trim() : undefined,
        join_receipt: newUserIntent === "create" && approvedForName ? receiptRef.current?.value : undefined,
      });
      if (!alive.current) return;
      setPendingNewUserName(null);
      if (newUserIntent === "create" && approvedForName) clearReceipt();
      if (onJoined) { onJoined(payload); return; }
      completeOAuthLogin();
      loginFromJoin(payload);
      const oauthReturn = readOAuthRequest();
      if (oauthReturn) {
        navigate(oauthReturnForAccount(oauthReturn, slug, payload.auth.data.user_id), { replace: true });
        return;
      }
      const pendingInviteToken = readPendingFriendInviteToken();
      if (pendingInviteToken) {
        navigate(`/friend-invite#token=${encodeURIComponent(pendingInviteToken)}`, { replace: true });
      } else {
        clearPendingFriendInviteToken();
        navigate(loginReturn, { replace: true });
      }
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof ApiError && error.identifier === "USER@NEW_USER_CONFIRMATION_REQUIRED") {
        setPendingNewUserName(name);
        return;
      }
      if (newUserIntent === "create" && error instanceof ApiError) {
        if (error.identifier === "SPACE@JOIN_INVITE_REQUIRED") {
          setSpace(previous => previous && { ...previous, join_mode: "invite" });
          setAdmissionError(t("admission.invalidCode"));
          return;
        }
        if (error.identifier === "SPACE@JOIN_APPROVAL_REQUIRED") {
          setSpace(previous => previous && { ...previous, join_mode: "approval" });
          setAdmissionError(t("admission.approvalNeeded"));
          return;
        }
        if (joinMode !== "open" && error.identifier !== "USER@NEW_USER_NAME_TAKEN") {
          setAdmissionError(error.message);
          return;
        }
      }
      setPendingNewUserName(null);
      if (isPasswordRequiredJoinError(error)) {
        setShowPasswordField(true);
        setPasswordHint(t("join.passwordRequired"));
        return;
      }

      const message = error instanceof ApiError && error.identifier === "USER@NEW_USER_NAME_TAKEN"
        ? t("join.nicknameTakenSinceConfirmation")
        : error instanceof ApiError ? error.message : t("join.failed");
      setSubmitError(message);
    } finally {
      setSubmitState("idle");
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = nickname.trim();
    if (!name) {
      setSubmitError(t("join.enterNickname"));
      return;
    }
    if (Array.from(name).length > MAX_NICKNAME_LENGTH) {
      setSubmitError(t("join.nicknameTooLong", { count: MAX_NICKNAME_LENGTH }));
      return;
    }
    void attemptJoin(name, "check");
  };

  return (
    <AppChrome
      embedded={embedded}
      guestSpaceBrand={{
        name: space?.name || displaySlug(slug) || slug,
        avatarUri: space?.official_user?.avatar_uri,
      }}
      hidePageTitle
      publicHeader
      title={space?.name || displaySlug(slug) || slug}
    >
      <section className={`auth-shell${embedded ? " pwa-space-login" : ""}`}>
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
              {!embedded ? <div className="join-space-head">
                <p className="join-space-kicker">{t("join.welcome", { name: space?.name || displaySlug(slug) })}</p>
                <h2>{t("join.nicknamePrompt")}</h2>
              </div> : null}

              {!embedded && space?.official_user ? (
                <div className="join-space-official-card">
                  <SpaceAvatar
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

              {joinMode !== "open" && <p className="join-admission-hint">{t(joinMode === "invite" ? "admission.inviteHint" : "admission.approvalHint")}</p>}
              {joinMode === "approval" && application && <section className="join-application-status">
                <div>
                  <strong>{t(`admission.status.${application.status}`)} · {application.name}</strong>
                  {application.status === "pending" && <small>{t("admission.receiptHint")}</small>}
                  {applicationError && <p role="alert">{applicationError}</p>}
                </div>
                {application.status === "approved" ? <button type="button" className="ghost-button" disabled={submitState === "submitting"}
                  onClick={() => { setAdmissionError(""); setPendingNewUserName(application.name); }}>{t("admission.completeJoin")}</button>
                  : <button type="button" className="ghost-button" disabled={applicationLoading} onClick={() => void refreshApplication()}>
                    {t(applicationLoading ? "common.loading" : "management.refresh")}
                  </button>}
              </section>}

              <div>
                <label className="field-label">{t("join.nickname")}</label>
                <input
                  className="input"
                  aria-label={t("join.nickname")}
                  autoComplete="username"
                  placeholder={t("join.nicknamePlaceholder")}
                  value={nickname}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setNickname(nicknameComposingRef.current ? nextValue : limitNickname(nextValue));
                    setPasswordHint(null);
                  }}
                  onCompositionStart={() => {
                    nicknameComposingRef.current = true;
                  }}
                  onCompositionEnd={(event) => {
                    nicknameComposingRef.current = false;
                    setNickname(limitNickname(event.currentTarget.value));
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
                    aria-label={t("join.password")}
                    autoComplete="current-password"
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
              {!embedded ? <><div className="join-login-divider"><i /><span>{t("join.or")}</span><i /></div>
              <button className="ghost-button join-wechat-login" onClick={() => showToast(t("join.wechatMiniProgramHint"))} type="button">
                <span className="material-symbols-outlined">chat</span>
                {t("join.wechatLogin")}
              </button></> : null}
            </form>
          ) : null}
        </div>
      </section>
      <AsyncErrorDialog message={submitError ?? ""} onClose={() => setSubmitError(null)} open={Boolean(submitError)} />
      <ConfirmDialog
        busy={submitState === "submitting"}
        cancelLabel={t("join.editNickname")}
        confirmLabel={t(requestingApproval ? "admission.apply" : joinMode === "open" ? "join.confirmNewNicknameAction" : "admission.completeJoin")}
        confirmDisabled={waitingForApplication || (joinMode !== "open" && !requestingApproval && (newPassword.trim().length < 6 || (joinMode === "invite" && !joinCode.trim())))}
        description={requestingApproval ? t("admission.applyAs", { name: pendingNewUserName || "" })
          : t("join.confirmNewNicknameHint", { name: pendingNewUserName ?? "", space: space?.name || displaySlug(slug) })}
        onClose={() => { if (submitState !== "submitting") { setPendingNewUserName(null); setAdmissionError(""); setNewPassword(""); setJoinCode(""); } }}
        onConfirm={() => {
          if (!pendingNewUserName) return;
          if (requestingApproval) void requestApproval(pendingNewUserName);
          else void attemptJoin(pendingNewUserName, "create");
        }}
        open={Boolean(pendingNewUserName)}
        title={t(requestingApproval ? "admission.apply" : "join.confirmNewNickname")}
      >
        {joinMode !== "open" && <div className="join-admission-fields">
          {waitingForApplication ? <p>{t("admission.existingApplication")}</p> : requestingApproval
            ? <label>{t("admission.note")}<textarea className="input" maxLength={240} value={applicationNote}
              onChange={event => setApplicationNote(event.target.value)} disabled={submitState === "submitting"} /></label>
            : <>
              {joinMode === "invite" && <label>{t("admission.code")}<input className="input mono" value={joinCode}
                autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={32} disabled={submitState === "submitting"}
                onChange={event => setJoinCode(event.target.value)} /></label>}
              <label>{t("admission.newPassword")}<input className="input" type="password" autoComplete="new-password" value={newPassword}
                onChange={event => setNewPassword(event.target.value)} disabled={submitState === "submitting"} /></label>
              <small>{t("admission.passwordHint")}</small>
            </>}
          {admissionError && <p className="join-admission-error" role="alert">{admissionError}</p>}
        </div>}
      </ConfirmDialog>
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
