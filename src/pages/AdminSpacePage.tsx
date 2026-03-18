import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { getBrowserJoinLanguage } from "../lib/language";
import { buildJoinPath, normalizeSlug } from "../lib/spaceEntry";

type AdminMode = "create" | "login";

function routeMode(value: string | null): AdminMode {
  return value === "create" ? "create" : "login";
}

export default function AdminSpacePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<AdminMode>(routeMode(searchParams.get("mode")));
  const [spaceName, setSpaceName] = useState("Neon Corner");
  const [slug, setSlug] = useState(normalizeSlug(searchParams.get("slug") ?? ""));
  const [email, setEmail] = useState("team@sermo.space");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<{ slug?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "code">("idle");

  useEffect(() => {
    if (session) navigate("/app/chats", { replace: true });
  }, [navigate, session]);

  useEffect(() => {
    setMode(routeMode(searchParams.get("mode")));
    setSlug(normalizeSlug(searchParams.get("slug") ?? ""));
  }, [searchParams]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const canSendCode = useMemo(() => {
    if (mode === "create") return email.trim().length > 3;
    return slug.length > 0 && email.trim().length > 3;
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
      setSubmitError(mode === "create" ? "请先输入可用邮箱。" : "请先输入 slug 和邮箱。");
      return;
    }

    setSubmitError(null);
    setSuccessMessage(null);
    setSubmitState("code");

    try {
      await api.postSpaceEmailCode({
        slug: mode === "create" ? undefined : slug,
        email: email.trim().toLowerCase(),
      });
      setCountdown(60);
      setSuccessMessage("验证码已发送。");
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
      setErrors({ slug: "请输入 Space slug。" });
      return;
    }

    setErrors({});
    setSubmitState("submitting");

    try {
      if (mode === "create") {
        await api.createSpace({
          name: spaceName.trim(),
          slug,
          email: email.trim().toLowerCase(),
          code: code.trim(),
          language: getBrowserJoinLanguage(),
        });
      } else {
        await api.loginSpace({
          slug,
          email: email.trim().toLowerCase(),
          code: code.trim(),
        });
      }

      navigate(buildJoinPath(slug), { replace: true });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "请求失败";
      setSubmitError(message);
    } finally {
      setSubmitState("idle");
    }
  };

  return (
    <AppChrome title="管理 Space" topbarAction={slug ? <Link className="ghost-chip" to={buildJoinPath(slug)}>成员加入页</Link> : null}>
      <section className="auth-shell">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`mode-pill ${mode === "create" ? "active" : ""}`} onClick={() => updateMode("create")} type="button">
              创建 Space
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
                  <label className="field-label">Space 名称</label>
                  <input className="input" value={spaceName} onChange={(event) => setSpaceName(event.target.value)} />
                </div>
                <div>
                  <label className="field-label">Space slug</label>
                  <input
                    className="input"
                    value={slug}
                    onChange={(event) => setSlug(normalizeSlug(event.target.value))}
                    placeholder="sermo-lab"
                  />
                  {errors.slug ? <div className="validation-error">{errors.slug}</div> : null}
                </div>
              </div>
            ) : null}

            {mode === "login" ? (
              <div>
                <label className="field-label">Space slug</label>
                <input
                  className="input"
                  value={slug}
                  onChange={(event) => setSlug(normalizeSlug(event.target.value))}
                  placeholder="sermo-lab"
                />
                {errors.slug ? <div className="validation-error">{errors.slug}</div> : null}
              </div>
            ) : null}

            <div>
              <label className="field-label">
                <span>管理员邮箱</span>
                <button className="ghost-button" disabled={!canSendCode || submitState === "code"} onClick={() => void sendCode()} type="button">
                  {submitState === "code" ? "发送中..." : countdown > 0 ? `${countdown}s` : "发送验证码"}
                </button>
              </label>
              <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>

            <div>
              <label className="field-label">验证码</label>
              <input className="input mono" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} />
            </div>

            <button className="button auth-submit" disabled={submitState === "submitting"} type="submit">
              {submitState === "submitting" ? "处理中..." : mode === "create" ? "创建 Space" : "进入管理"}
            </button>
          </form>
        </div>
      </section>
      <AsyncErrorDialog message={submitError ?? ""} onClose={() => setSubmitError(null)} open={Boolean(submitError)} />
    </AppChrome>
  );
}
