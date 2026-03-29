import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { ApiError, api } from "../lib/api";
import { useAdminAuth } from "../lib/adminAuth";
import { useAuth } from "../lib/auth";
import { getBrowserJoinLanguage } from "../lib/language";
import { buildJoinHrefForCurrentHost, normalizeSlug } from "../lib/spaceEntry";

type AdminMode = "create" | "login";

function routeMode(value: string | null): AdminMode {
  return value === "create" ? "create" : "login";
}

export default function AdminSpacePage() {
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
      setSubmitError(mode === "create" ? "请先输入可用邮箱。" : "请先输入空间标识。");
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
      setSuccessMessage(`验证码已发送到 ${payload.masked_email}。`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "验证码发送失败";
      setSubmitError(message);
    } finally {
      setSubmitState("idle");
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (!slug.trim()) {
      setErrors({ slug: "请输入空间标识。" });
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
      const message = error instanceof ApiError ? error.message : "请求失败";
      setSubmitError(message);
    } finally {
      setSubmitState("idle");
    }
  };

  return (
    <AppChrome
      title="管理空间"
      topbarAction={
        slug ? (
          <a className="ghost-chip" href={buildJoinHrefForCurrentHost(slug)}>
            成员加入页
          </a>
        ) : session ? (
          <button className="ghost-chip" onClick={() => navigate("/app/chats")} type="button">
            返回聊天
          </button>
        ) : null
      }
    >
      <section className="auth-shell">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`mode-pill ${mode === "create" ? "active" : ""}`} onClick={() => updateMode("create")} type="button">
              创建空间
            </button>
            <button className={`mode-pill ${mode === "login" ? "active" : ""}`} onClick={() => updateMode("login")} type="button">
              管理登录
            </button>
          </div>

          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            {successMessage ? <div className="inline-note success-note">{successMessage}</div> : null}

            {mode === "create" ? (
              <div className="field-stack">
                <div>
                  <label className="field-label">空间名称</label>
                  <input className="input" placeholder="输入空间名称" value={spaceName} onChange={(event) => setSpaceName(event.target.value)} />
                </div>
                <div>
                  <label className="field-label">空间标识</label>
                  <input
                    className="input"
                    value={slug}
                    onChange={(event) => setSlug(normalizeSlug(event.target.value))}
                    placeholder="输入空间标识"
                  />
                  {errors.slug ? <div className="validation-error">{errors.slug}</div> : null}
                </div>
              </div>
            ) : null}

            {mode === "login" ? (
              <div>
                <label className="field-label">空间标识</label>
                <input
                  className="input"
                  value={slug}
                  onChange={(event) => setSlug(normalizeSlug(event.target.value))}
                  placeholder="输入空间标识"
                />
                {errors.slug ? <div className="validation-error">{errors.slug}</div> : null}
              </div>
            ) : null}

            {mode === "create" ? (
              <div>
                <label className="field-label">
                  <span>管理员邮箱</span>
                  <button className="ghost-button" disabled={!canSendCode || submitState === "code"} onClick={() => void sendCode()} type="button">
                    {submitState === "code" ? "发送中..." : countdown > 0 ? `${countdown}s` : "发送验证码"}
                  </button>
                </label>
                <input
                  className="input"
                  inputMode="email"
                  placeholder="输入管理员邮箱"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            ) : (
              <div className="auth-assist-block">
                <label className="field-label">
                  <span>管理员邮箱</span>
                  <button className="ghost-button" disabled={!canSendCode || submitState === "code"} onClick={() => void sendCode()} type="button">
                    {submitState === "code" ? "发送中..." : countdown > 0 ? `${countdown}s` : "发送验证码"}
                  </button>
                </label>
                <div className="inline-note">输入空间标识后，我们会自动向该空间管理员邮箱发送验证码。</div>
              </div>
            )}

            <div>
              <label className="field-label">验证码</label>
              <input className="input mono" inputMode="numeric" placeholder="输入验证码" value={code} onChange={(event) => setCode(event.target.value)} />
            </div>

            <button className="button auth-submit" disabled={submitState === "submitting"} type="submit">
              {submitState === "submitting" ? "处理中..." : mode === "create" ? "创建空间" : "进入管理"}
            </button>
          </form>
        </div>
      </section>
      <AsyncErrorDialog message={submitError ?? ""} onClose={() => setSubmitError(null)} open={Boolean(submitError)} />
    </AppChrome>
  );
}
