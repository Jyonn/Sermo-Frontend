import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { getBrowserJoinLanguage } from "../lib/language";
import { buildAdminHrefForCurrentHost, buildAdminPath, normalizeSlug } from "../lib/spaceEntry";

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
  const slug = useMemo(() => normalizeSlug(routeSlug), [routeSlug]);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");

  useEffect(() => {
    if (session) navigate("/app/chats", { replace: true });
  }, [navigate, session]);

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
      title={displaySlug(slug) || slug}
      topbarAction={
        <a className="ghost-chip" href={adminHref}>
          管理员登录
        </a>
      }
    >
      <section className="auth-shell">
        <div className="auth-card">
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
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
              {submitState === "submitting" ? "进入中..." : "进入 Space"}
            </button>
          </form>
        </div>
      </section>
      <AsyncErrorDialog message={submitError ?? ""} onClose={() => setSubmitError(null)} open={Boolean(submitError)} />
    </AppChrome>
  );
}
