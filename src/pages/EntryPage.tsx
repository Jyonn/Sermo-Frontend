import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { EntryMode } from "../types";

interface EntryPageProps {
  mode: EntryMode;
}

const modeContent = {
  create: {
    eyebrow: "Create Space",
    title: "三步创建你的 Space",
    subtitle: "创建品牌感更强的进入层：发验证码、填写名称与 slug、完成创建后继续进入聊天。",
    cta: "创建并进入 Space",
  },
  login: {
    eyebrow: "Space Login",
    title: "使用 Space 邮箱验证码登录",
    subtitle: "登录流保持低门槛，但错误提示必须紧贴字段，便于快速纠正。",
    cta: "登录 Space",
  },
  join: {
    eyebrow: "Join Space",
    title: "10 秒内进入会话",
    subtitle: "加入流程聚焦昵称唯一性、密码可选和低打扰反馈，让用户优先体验聊天。",
    cta: "进入 Space",
  },
} as const;

const modeRoutes: Record<EntryMode, string> = {
  create: "/space/create",
  login: "/space/login",
  join: "/space/join",
};

function digitsFromCode(code: string) {
  return Array.from({ length: 6 }, (_, index) => code[index] ?? "");
}

export default function EntryPage({ mode }: EntryPageProps) {
  const { loginFromJoin, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [spaceName, setSpaceName] = useState("Neon Corner");
  const [slug, setSlug] = useState(searchParams.get("slug") ?? "sermo-lab");
  const [nickname, setNickname] = useState("Alex Nova");
  const [email, setEmail] = useState("team@sermo.space");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState<{ slug?: string; nickname?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "code">("idle");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (session && location.pathname === "/entry") {
      navigate("/app/chats", { replace: true });
    }
  }, [location.pathname, navigate, session]);

  useEffect(() => {
    setErrors({});
    setSubmitError(null);
    setSuccessMessage(null);
    if (mode === "create") {
      setCode("82");
    } else if (mode === "login") {
      setCode("147");
    } else {
      setCode("");
    }
  }, [mode]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const canSendCode = useMemo(() => {
    if (mode === "join") return false;
    if (mode === "create") {
      return email.trim().length > 3;
    }
    return slug.trim().length > 0 && email.trim().length > 3;
  }, [email, mode, slug]);

  const sendCode = async () => {
    if (!canSendCode) {
      setSubmitError(mode === "create" ? "请先输入可用邮箱。" : "请先输入 slug 和邮箱。");
      return;
    }

    setSubmitError(null);
    setSubmitState("code");
    try {
      await api.postSpaceEmailCode({
        slug: mode === "create" ? undefined : slug.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
      });
      setCountdown(60);
      setSuccessMessage("验证码已发送，请留意邮箱。");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "验证码发送失败";
      setSubmitError(message);
    } finally {
      setSubmitState("idle");
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      const nextErrors: { slug?: string; nickname?: string } = {};
      setSubmitError(null);
      setSuccessMessage(null);

      if (!slug.trim()) {
        nextErrors.slug = "请输入 Space slug，系统会自动转为小写。";
      }

      if (mode === "join" && !nickname.trim()) {
        nextErrors.nickname = "昵称是加入 Space 的必填项，用于唯一身份识别。";
      }

      setErrors(nextErrors);
      if (Object.keys(nextErrors).length !== 0) {
        return;
      }
      setSubmitState("submitting");

      try {
        if (mode === "create") {
          await api.createSpace({
            name: spaceName.trim(),
            slug: slug.trim().toLowerCase(),
            email: email.trim().toLowerCase(),
            code: code.trim(),
          });
          navigate(`/space/join?slug=${encodeURIComponent(slug.trim().toLowerCase())}`, {
            replace: true,
          });
          return;
        }

        if (mode === "login") {
          await api.loginSpace({
            slug: slug.trim().toLowerCase(),
            email: email.trim().toLowerCase(),
            code: code.trim(),
          });
          navigate(`/space/join?slug=${encodeURIComponent(slug.trim().toLowerCase())}`, {
            replace: true,
          });
          return;
        }

        const payload = await api.joinSpace({
          slug: slug.trim().toLowerCase(),
          name: nickname.trim(),
          password: password.trim() || undefined,
        });
        loginFromJoin(payload);
        navigate("/app/chats", { replace: true });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "请求失败";
        setSubmitError(message);
      } finally {
        setSubmitState("idle");
      }
    })();
  };

  const content = modeContent[mode];

  return (
    <AppChrome footerNote="当前已接入真实入口接口；创建与 Space 登录成功后会引导到加入页，用 user JWT 进入业务主界面。">
      <section className="entry-layout">
        <div className="entry-hero">
          <div>
            <span className="hero-badge">
              <span className="material-symbols-outlined">bolt</span>
              快 / 酷 / 清 / 稳
            </span>
            <h1>Space-based IM for expressive circles.</h1>
            <p>
              这版已经进入真实工程结构，后续可以直接把验证码、Space 创建、加入登录和 JWT 流程接到真实接口。
            </p>
          </div>

          <div className="hero-metrics">
            <div className="metric">
              <p className="metric-value">3</p>
              <p className="metric-label">进入路径</p>
            </div>
            <div className="metric">
              <p className="metric-value">60s</p>
              <p className="metric-label">验证码倒计时</p>
            </div>
            <div className="metric">
              <p className="metric-value">AA</p>
              <p className="metric-label">可读性目标</p>
            </div>
          </div>
        </div>

        <section className="card">
          <div className="card-header">
            <p className="eyebrow">{content.eyebrow}</p>
            <h2 className="card-title">{content.title}</h2>
            <p className="card-subtitle">{content.subtitle}</p>
          </div>

          <div className="mode-switch">
            {(["create", "login", "join"] as const).map((item) => (
              <Link key={item} className={`mode-pill ${mode === item ? "active" : ""}`} to={modeRoutes[item]}>
                {item === "create" ? "创建" : item === "login" ? "登录" : "加入"}
              </Link>
            ))}
          </div>

          <form className="form-grid" onSubmit={submit}>
            {submitError ? <div className="alert">{submitError}</div> : null}
            {successMessage ? <div className="inline-note">{successMessage}</div> : null}
            {mode === "create" ? (
              <>
                <div>
                  <label className="field-label">Space 名称</label>
                  <input className="input" value={spaceName} onChange={(event) => setSpaceName(event.target.value)} />
                </div>
                <div>
                  <label className="field-label">
                    <span>Space Slug</span>
                    <span className="field-help">自动转小写</span>
                  </label>
                  <input
                    className="input"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value.toLowerCase())}
                    placeholder="neon-corner"
                  />
                  {errors.slug ? <div className="validation-error">{errors.slug}</div> : null}
                </div>
                <div>
                  <div className="field-line">
                    <label>邮箱</label>
                    <input className="input" style={{ flex: 1 }} value={email} onChange={(event) => setEmail(event.target.value)} />
                  </div>
                </div>
              </>
            ) : null}

            {mode === "login" ? (
              <>
                <div>
                  <label className="field-label">Space Slug</label>
                  <input
                    className="input"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value.toLowerCase())}
                    placeholder="sermo-lab"
                  />
                  {errors.slug ? <div className="validation-error">{errors.slug}</div> : null}
                </div>
                <div>
                  <label className="field-label">邮箱</label>
                  <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
              </>
            ) : null}

            {mode === "join" ? (
              <>
                <div>
                  <label className="field-label">
                    <span>Space Slug</span>
                    <span className="field-help">不可为空</span>
                  </label>
                  <input
                    className="input"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value.toLowerCase())}
                    placeholder="sermo-lab"
                  />
                  {errors.slug ? <div className="validation-error">{errors.slug}</div> : null}
                </div>

                <div className="input-row">
                  <div>
                    <label className="field-label">昵称</label>
                    <input className="input" value={nickname} onChange={(event) => setNickname(event.target.value)} />
                    {errors.nickname ? <div className="validation-error">{errors.nickname}</div> : null}
                  </div>
                  <div>
                    <label className="field-label">访问密码</label>
                    <input className="input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="可选" />
                  </div>
                </div>

                <div className="inline-note">
                  <strong>状态要求：</strong>错误文案贴字段展示；昵称重复时给出可行动建议；提交成功后直接进入聊天主界面。
                </div>
              </>
            ) : null}

            {mode !== "join" ? (
              <div>
                <div className="field-line">
                  <label>验证码</label>
                  <button className="ghost-button" type="button" onClick={() => void sendCode()}>
                    {submitState === "code" ? "发送中..." : countdown > 0 ? `${countdown}s 后重发` : "发送验证码"}
                  </button>
                </div>
                <div className="code-row">
                  {digitsFromCode(code).map((digit, index) => (
                    <input
                      key={index}
                      className="code-box"
                      value={digit}
                      maxLength={1}
                      inputMode="numeric"
                      onChange={(event) => {
                        const next = digitsFromCode(code);
                        next[index] = event.target.value.slice(-1);
                        setCode(next.join(""));
                      }}
                    />
                  ))}
                </div>
                <div className="prototype-note">验证码已发送后展示倒计时，真实接入时还需要后端返回失效时间。</div>
              </div>
            ) : null}

            <div className="button-row">
              <button className="button" disabled={submitState === "submitting"} type="submit">
                <span>{submitState === "submitting" ? "处理中..." : content.cta}</span>
                <span className="material-symbols-outlined">east</span>
              </button>
              {mode !== "join" ? (
                <button className="ghost-button" onClick={sendCode} type="button">
                  {submitState === "code" ? "发送中..." : "先发验证码"}
                </button>
              ) : null}
              <Link className="ghost-button" to="/app/chats">
                查看主界面
              </Link>
            </div>
          </form>

          <p className="prototype-note">
            路由已经按规范拆分成 <span className="mono">/space/create /space/login /space/join</span>。
          </p>
        </section>
      </section>
    </AppChrome>
  );
}
