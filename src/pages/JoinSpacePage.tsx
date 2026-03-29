import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { getBrowserJoinLanguage } from "../lib/language";
import { buildAdminEntryHref, buildAdminHrefForCurrentHost, buildAdminPath, buildHomeHrefForCurrentHost, getDetectedSpaceSlug, normalizeSlug } from "../lib/spaceEntry";
import type { SpaceDTO } from "../types";

function displaySlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export default function JoinSpacePage() {
  const { slug: routeSlug = "" } = useParams();
  const navigate = useNavigate();
  const { loginFromJoin, session } = useAuth();
  const detectedSlug = getDetectedSpaceSlug();
  const slug = useMemo(() => normalizeSlug(routeSlug || detectedSlug || ""), [detectedSlug, routeSlug]);
  const spaceDomainLabel = useMemo(() => {
    if (typeof window !== "undefined" && window.location.hostname) return window.location.hostname;
    return slug ? `${slug}.sermo.jyonn.space` : "sermo.jyonn.space";
  }, [slug]);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [space, setSpace] = useState<SpaceDTO | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "ready" | "missing" | "error">("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");

  useEffect(() => {
    if (session) navigate("/app/chats", { replace: true });
  }, [navigate, session]);

  useEffect(() => {
    if (!slug) navigate("/space", { replace: true });
  }, [navigate, slug]);

  useEffect(() => {
    if (!slug) return;

    const controller = new AbortController();
    setLookupState("loading");
    setSpace(null);
    setLookupError(null);
    setShowPasswordField(false);

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
        setLookupError(error instanceof ApiError ? error.message : "暂时无法确认这个空间是否存在");
      });

    return () => controller.abort();
  }, [slug]);

  const adminHref =
    typeof window !== "undefined" && window.location.hostname !== "localhost" ? buildAdminHrefForCurrentHost(slug) : buildAdminPath(slug, "login");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nickname.trim()) {
      setSubmitError("请输入昵称。");
      return;
    }

    setSubmitError(null);
    setSubmitState("submitting");
    try {
      const payload = await api.joinSpace({
        slug,
        name: nickname.trim(),
        password: password.trim() || undefined,
        language: getBrowserJoinLanguage(),
      });
      loginFromJoin(payload);
      navigate("/app/chats", { replace: true });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "加入失败";
      setSubmitError(message);
    } finally {
      setSubmitState("idle");
    }
  };

  return (
    <AppChrome
      title={space?.name || displaySlug(slug) || slug}
      topbarAction={
        <a className="ghost-chip" href={adminHref}>
          管理员登录
        </a>
      }
    >
      <section className="auth-shell">
        <div className={`auth-card ${lookupState !== "ready" ? "is-space-state" : ""}`}>
          {lookupState === "loading" ? (
            <div className="join-space-state loading">
              <div className="join-space-state-hero">
                <p className="join-space-state-kicker">空间校验</p>
                <div className="join-space-domain">{spaceDomainLabel}</div>
              </div>
              <div className="join-space-state-badge">正在确认</div>
              <div className="join-space-state-copy">
                <h2>我们正在确认这个入口属于哪个空间</h2>
                <p>请稍等片刻，我们会先核对子域名和对应空间的关系，再决定是否展示加入页面。</p>
              </div>
            </div>
          ) : null}

          {lookupState === "missing" ? (
            <div className="join-space-state missing">
              <div className="join-space-state-hero">
                <p className="join-space-state-kicker">空间不存在</p>
                <div className="join-space-domain">{spaceDomainLabel}</div>
              </div>
              <div className="join-space-state-badge">还没有创建</div>
              <div className="join-space-state-copy">
                <h2>这个空间还没有创建</h2>
                <p>我们没有找到与这个子域名对应的空间。你可以先了解 Sermo，或者直接把它创建成一个新的专属入口。</p>
              </div>
              <div className="join-space-state-actions">
                <a className="button" href={buildHomeHrefForCurrentHost()}>
                  了解 Sermo
                </a>
                <a className="ghost-button" href={buildAdminEntryHref("create", slug)}>
                  创建这个空间
                </a>
              </div>
            </div>
          ) : null}

          {lookupState === "error" ? (
            <div className="join-space-state error">
              <div className="join-space-state-hero">
                <p className="join-space-state-kicker">空间校验失败</p>
                <div className="join-space-domain">{spaceDomainLabel}</div>
              </div>
              <div className="join-space-state-badge">暂时不可用</div>
              <div className="join-space-state-copy">
                <h2>暂时无法确认这个空间</h2>
                <p>可能是网络波动，或者服务暂时不可用。你可以重新检查，或者先了解 Sermo，稍后再试。</p>
              </div>
              <div className="join-space-state-actions">
                <a className="button" href={buildHomeHrefForCurrentHost()}>
                  了解 Sermo
                </a>
                <button
                  className="ghost-button"
                  onClick={() => {
                    window.location.reload();
                  }}
                  type="button"
                >
                  重新检查
                </button>
              </div>
            </div>
          ) : null}

          {lookupState === "ready" ? (
            <form className="auth-form" onSubmit={(event) => void submit(event)}>
              <div className="join-space-head">
                <p className="join-space-kicker">欢迎来到 {space?.name || displaySlug(slug)}</p>
                <h2>{space?.official_user?.name ? `先和 ${space.official_user.name} 打个招呼，再加入这里` : "先用一个昵称，进入这个空间"}</h2>
              </div>

              <div>
                <label className="field-label">昵称</label>
                <input
                  className="input"
                  placeholder="你在聊天里显示的名字"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                />
              </div>

              {!showPasswordField ? (
                <button className="ghost-button auth-toggle" onClick={() => setShowPasswordField(true)} type="button">
                  有访问密码？
                </button>
              ) : (
                <div>
                  <label className="field-label">访问密码</label>
                  <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </div>
              )}

              <button className="button auth-submit" disabled={submitState === "submitting"} type="submit">
                {submitState === "submitting" ? "进入中..." : "进入空间"}
              </button>
            </form>
          ) : null}
        </div>
      </section>
      <AsyncErrorDialog
        title="暂时无法确认这个空间"
        message={lookupError ?? ""}
        onClose={() => setLookupError(null)}
        open={Boolean(lookupError) && lookupState === "error"}
      />
      <AsyncErrorDialog message={submitError ?? ""} onClose={() => setSubmitError(null)} open={Boolean(submitError)} />
    </AppChrome>
  );
}
