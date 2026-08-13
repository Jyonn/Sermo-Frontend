import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import { ApiError, api } from "../lib/api";
import { useAdminAuth } from "../lib/adminAuth";
import { useAuth } from "../lib/auth";
import { getBrowserJoinLanguage, useI18n } from "../lib/language";
import { buildJoinHrefForCurrentHost, normalizeSlug } from "../lib/spaceEntry";
import { showToast } from "../lib/toast";

type AdminMode = "create" | "login";

function routeMode(value: string | null): AdminMode {
  return value === "create" ? "create" : "login";
}

export default function AdminSpacePage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const { session: adminSession, login: loginAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<AdminMode>(routeMode(searchParams.get("mode")));
  const [spaceName, setSpaceName] = useState("");
  const [slug, setSlug] = useState(normalizeSlug(searchParams.get("slug") ?? ""));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<{ slug?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "code">("idle");

  useEffect(() => {
    if (adminSession) navigate("/space/dashboard", { replace: true });
  }, [adminSession, navigate]);

  useEffect(() => {
    setMode(routeMode(searchParams.get("mode")));
    setSlug(normalizeSlug(searchParams.get("slug") ?? ""));
  }, [searchParams]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    setCountdown(0);
    setSuccessMessage(null);
  }, [email, mode, slug]);

  const canSendCode = useMemo(() => {
    if (mode === "create") return email.trim().length > 3;
    return slug.length > 0;
  }, [email, mode, slug]);

  const updateMode = (nextMode: AdminMode) => {
    const params = new URLSearchParams(searchParams);
    params.set("mode", nextMode);
    if (slug) params.set("slug", slug);
    else params.delete("slug");
    setSearchParams(params, { replace: true });
  };

  const sendCode = async () => {
    if (!canSendCode) {
      setSubmitError(mode === "create" ? t("admin.emailRequired") : t("admin.slugRequired"));
      return;
    }

    setSubmitError(null);
    setSuccessMessage(null);
    setSubmitState("code");

    try {
      const payload = await api.postSpaceEmailCode({
        slug: mode === "create" ? undefined : slug,
        email: mode === "create" ? email.trim().toLowerCase() : undefined,
      });
      setCountdown(60);
      setSuccessMessage(t("admin.codeSentTo", { email: payload.masked_email }));
      showToast(t("admin.codeSent"));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("admin.codeFailed");
      setSubmitError(message);
      showToast(message, "error");
    } finally {
      setSubmitState("idle");
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (!slug.trim()) {
      setErrors({ slug: t("admin.slugRequired") });
      return;
    }

    setErrors({});
    setSubmitState("submitting");

    try {
      if (mode === "create") {
        const payload = await api.createSpace({
          name: spaceName.trim(),
          slug,
          email: email.trim().toLowerCase(),
          code: code.trim(),
          language: getBrowserJoinLanguage(),
        });
        loginAdmin(payload.space, payload.auth);
      } else {
        const payload = await api.loginSpace({
          slug,
          code: code.trim(),
        });
        loginAdmin(payload.space, payload.auth);
      }

      navigate("/space/dashboard", { replace: true });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("admin.requestFailed");
      setSubmitError(message);
    } finally {
      setSubmitState("idle");
    }
  };

  return (
    <AppChrome
      publicHeader
      title={t("admin.title")}
      topbarAction={
        slug ? (
          <a className="ghost-chip" href={buildJoinHrefForCurrentHost(slug)}>
            {t("admin.memberEntry")}
          </a>
        ) : session ? (
          <button className="ghost-chip" onClick={() => navigate("/app/chats")} type="button">
            {t("admin.backChat")}
          </button>
        ) : null
      }
    >
      <section className="auth-shell">
        <div className="auth-card admin-auth-card">
          <div className="admin-auth-head">
            <p className="admin-auth-kicker">{t("admin.kicker")}</p>
            <h1>{mode === "create" ? t("admin.createHeading") : t("admin.loginHeading")}</h1>
            <p>{mode === "create" ? t("admin.createHint") : t("admin.loginHint")}</p>
          </div>

          <div className="auth-tabs">
            <button className={`mode-pill ${mode === "create" ? "active" : ""}`} onClick={() => updateMode("create")} type="button">
              {t("admin.createTab")}
            </button>
            <button className={`mode-pill ${mode === "login" ? "active" : ""}`} onClick={() => updateMode("login")} type="button">
              {t("admin.loginTab")}
            </button>
          </div>

          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            {successMessage ? <div className="inline-note success-note">{successMessage}</div> : null}

            {mode === "create" ? (
              <div className="field-stack">
                <div>
                  <label className="field-label">{t("admin.spaceName")}</label>
                  <input className="input" placeholder={t("admin.spaceNamePlaceholder")} value={spaceName} onChange={(event) => setSpaceName(event.target.value)} />
                </div>
                <div>
                  <label className="field-label">{t("admin.spaceSlug")}</label>
                  <input
                    className="input"
                    value={slug}
                    onChange={(event) => setSlug(normalizeSlug(event.target.value))}
                    placeholder={t("admin.spaceSlugPlaceholder")}
                  />
                  {errors.slug ? <div className="validation-error">{errors.slug}</div> : null}
                </div>
              </div>
            ) : null}

            {mode === "login" ? (
              <div>
                <label className="field-label">{t("admin.spaceSlug")}</label>
                <input
                  className="input"
                  value={slug}
                  onChange={(event) => setSlug(normalizeSlug(event.target.value))}
                  placeholder={t("admin.spaceSlugPlaceholder")}
                />
                {errors.slug ? <div className="validation-error">{errors.slug}</div> : null}
              </div>
            ) : null}

            {mode === "create" ? (
              <div>
                <label className="field-label">
                  <span>{t("admin.email")}</span>
                  <button className="ghost-button" disabled={!canSendCode || submitState === "code"} onClick={() => void sendCode()} type="button">
                    {submitState === "code" ? t("admin.sending") : countdown > 0 ? `${countdown}s` : t("admin.sendCode")}
                  </button>
                </label>
                <input
                  className="input"
                  inputMode="email"
                  placeholder={t("admin.emailPlaceholder")}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            ) : (
              <div className="auth-assist-block">
                <button className="ghost-button admin-code-button" disabled={!canSendCode || submitState === "code"} onClick={() => void sendCode()} type="button">
                  {submitState === "code" ? t("admin.sending") : countdown > 0 ? t("admin.resendIn", { seconds: countdown }) : t("admin.sendAdminCode")}
                </button>
              </div>
            )}

            <div>
              <label className="field-label">{t("admin.code")}</label>
              <VerificationCodeInput ariaLabel={t("admin.code")} value={code} onChange={setCode} />
            </div>

            <button className="button auth-submit" disabled={submitState === "submitting" || code.length !== 6} type="submit">
              {submitState === "submitting" ? t("common.processing") : mode === "create" ? t("admin.createTab") : t("admin.enter")}
            </button>
          </form>
        </div>
      </section>
      <AsyncErrorDialog message={submitError ?? ""} onClose={() => setSubmitError(null)} open={Boolean(submitError)} />
    </AppChrome>
  );
}
