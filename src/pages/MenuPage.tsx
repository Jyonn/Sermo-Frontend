import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { FeedbackState } from "../components/FeedbackState";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AppViewState, SpaceDTO } from "../types";

function avatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function MenuPage() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceDTO | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setViewState("loading");
    setError(null);

    api
      .getSpaceMe(controller.signal)
      .then((spaceInfo) => {
        setSpace(spaceInfo);
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "菜单加载失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, []);

  const leave = async () => {
    await logout();
    navigate("/space/join");
  };

  return (
    <AppChrome title="菜单" mobileNav="menu" hideTopbar>
      <section className="page-stack">
        <div className="profile-strip">
          <div className="avatar-large">{avatarLabel(session?.user.name ?? "Sermo")}</div>
          <div className="row-main">
            <strong>{session?.user.name ?? "Sermo User"}</strong>
            <div className="row-subtle">{space ? `${space.name} · ${space.slug}` : "当前 Space"}</div>
          </div>
        </div>

        {viewState === "loading" ? <FeedbackState title="菜单加载中" description="正在同步你的常用入口。" tone="loading" /> : null}
        <section className="list-section">
          <div className="section-label">账号</div>
          <div className="simple-list">
            <Link className="simple-row menu-link-row" to="/app/settings/account">
              <div className="row-main">
                <strong>账号与验证</strong>
                <div className="row-subtle">升级、邮箱验证、密码</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
            <Link className="simple-row menu-link-row" to="/app/settings/contacts">
              <div className="row-main">
                <strong>联系方式</strong>
                <div className="row-subtle">Email、SMS、Bark</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
            <Link className="simple-row menu-link-row" to="/app/settings/notifications">
              <div className="row-main">
                <strong>通知偏好</strong>
                <div className="row-subtle">提醒方式与阈值</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
        </section>

        <section className="list-section">
          <div className="section-label">关系</div>
          <div className="simple-list">
            <Link className="simple-row menu-link-row" to="/app/friends/requests">
              <div className="row-main">
                <strong>好友与申请</strong>
                <div className="row-subtle">收到的、发出的、好友</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
            <Link className="simple-row menu-link-row" to="/app/space-users/online">
              <div className="row-main">
                <strong>在线成员</strong>
                <div className="row-subtle">只看当前在线的人</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
        </section>

        <section className="list-section">
          <div className="section-label">其它</div>
          <div className="simple-list">
            <Link className="simple-row menu-link-row" to="/app/notifications">
              <div className="row-main">
                <strong>通知中心</strong>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
            <button className="simple-row menu-link-row danger-row" onClick={() => void leave()} type="button">
              <div className="row-main">
                <strong>退出登录</strong>
              </div>
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </section>
      </section>
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
