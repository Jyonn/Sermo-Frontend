import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { clearPendingFriendInviteToken, readPendingFriendInviteToken } from "../lib/friendInvite";
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

function isPasswordRequiredJoinError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  return error.identifier === "USER@PASSWORD_REQUIRED";
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
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceDTO | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "ready" | "missing" | "error">("loading");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");

  useEffect(() => {
    if (!session) return;
    const pendingInviteToken = readPendingFriendInviteToken();
    if (pendingInviteToken) {
      navigate(`/friend-invite#token=${encodeURIComponent(pendingInviteToken)}`, { replace: true });
      return;
    }
    navigate("/app/chats", { replace: true });
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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nickname.trim()) {
      setSubmitError("请输入昵称。");
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
        navigate("/app/chats", { replace: true });
      }
    } catch (error) {
      if (isPasswordRequiredJoinError(error)) {
        setShowPasswordField(true);
        setPasswordHint("这个昵称已经设置了访问密码，请先输入密码。");
        return;
      }

      const message = error instanceof ApiError ? error.message : "加入失败";
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
          管理员登录
        </a>
      }
    >
      <section className="auth-shell">
        <div className={`auth-card ${lookupState !== "ready" ? "is-space-state" : ""}`}>
          {lookupState === "loading" ? (
            <div className="join-space-state loading">
              <div className="join-space-state-icon is-loading" aria-hidden="true"><span /></div>
              <div className="join-space-state-copy">
                <h2>正在确认空间</h2>
                <div className="join-space-domain">{spaceDomainLabel}</div>
              </div>
            </div>
          ) : null}

          {lookupState === "missing" ? (
            <div className="join-space-state missing">
              <div className="join-space-state-icon" aria-hidden="true"><span>404</span></div>
              <div className="join-space-state-copy">
                <h2>这个空间还没有创建</h2>
                <div className="join-space-domain">{spaceDomainLabel}</div>
                <p>创建它，或返回言浪主页。</p>
              </div>
              <div className="join-space-state-actions">
                <a className="button" href={buildHomeHrefForCurrentHost()}>
                  了解 Sermo 言浪
                </a>
                <a className="ghost-button" href={buildAdminEntryHref("create", slug)}>
                  创建这个空间
                </a>
              </div>
            </div>
          ) : null}

          {lookupState === "error" ? (
            <div className="join-space-state error">
              <div className="join-space-state-icon" aria-hidden="true"><span>!</span></div>
              <div className="join-space-state-copy">
                <h2>暂时无法确认这个空间</h2>
                <div className="join-space-domain">{spaceDomainLabel}</div>
                <p>检查网络后再试一次。</p>
              </div>
              <div className="join-space-state-actions">
                <a className="button" href={buildHomeHrefForCurrentHost()}>
                  了解 Sermo 言浪
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
                <h2>先用一个昵称，进入这个空间</h2>
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
                <label className="field-label">昵称</label>
                <input
                  className="input"
                  placeholder="你在聊天里显示的名字"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setPasswordHint(null);
                  }}
                />
              </div>

              {!showPasswordField ? (
                <button className="ghost-button auth-toggle" onClick={() => setShowPasswordField(true)} type="button">
                  有访问密码？
                </button>
              ) : (
                <div>
                  <label className="field-label">访问密码</label>
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
                {submitState === "submitting" ? "进入中..." : "进入空间"}
              </button>
            </form>
          ) : null}
        </div>
      </section>
      <AsyncErrorDialog message={submitError ?? ""} onClose={() => setSubmitError(null)} open={Boolean(submitError)} />
    </AppChrome>
  );
}
