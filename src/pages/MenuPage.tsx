import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { AvatarPresetDialog } from "../components/AvatarPresetDialog";
import { AsyncErrorDialog } from "../components/AsyncErrorDialog";
import { FeedbackState } from "../components/FeedbackState";
import { UserAvatar } from "../components/UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AppViewState, SpaceDTO } from "../types";

export default function MenuPage() {
  const navigate = useNavigate();
  const { session, logout, patchSessionUser } = useAuth();
  const [viewState, setViewState] = useState<AppViewState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [space, setSpace] = useState<SpaceDTO | null>(null);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (viewState === "idle") {
      setViewState("loading");
    }
    setError(null);

    Promise.all([api.getSpaceMe(controller.signal), api.getSpaceUsers({ limit: 200, offset: 0 }, controller.signal)])
      .then(([spaceInfo, users]) => {
        setSpace(spaceInfo);
        const currentUser = users.find((user) => user.user_id === session?.user.user_id);
        if (
          currentUser &&
          (currentUser.avatar_uri !== session?.user.avatar_uri || currentUser.avatar_type !== session?.user.avatar_type)
        ) {
          patchSessionUser({
            avatar_type: currentUser.avatar_type,
            avatar_uri: currentUser.avatar_uri,
          });
        }
        setViewState("ready");
      })
      .catch((apiError) => {
        if (controller.signal.aborted) return;
        const message = apiError instanceof ApiError ? apiError.message : "菜单加载失败";
        setError(message);
        setViewState("error");
      });

    return () => controller.abort();
  }, [patchSessionUser, session?.user.avatar_type, session?.user.avatar_uri, session?.user.user_id, viewState]);

  const leave = async () => {
    await logout();
    navigate("/space/join");
  };

  const savePresetAvatar = async (presetId: number) => {
    setError(null);
    try {
      setAvatarSaving(true);
      const payload = await api.setPresetAvatar(presetId);
      patchSessionUser({
        avatar_type: payload.avatar_type,
        avatar_uri: payload.avatar_uri,
      });
      setAvatarDialogOpen(false);
    } catch (apiError) {
      const message = apiError instanceof ApiError ? apiError.message : "头像更新失败";
      setError(message);
    } finally {
      setAvatarSaving(false);
    }
  };

  return (
    <AppChrome title="菜单" hideTopbar>
      <section className="page-stack">
        <div className="menu-profile-card">
          <button className="profile-avatar-button menu-profile-avatar" onClick={() => setAvatarDialogOpen(true)} type="button">
            <UserAvatar className="avatar-large" name={session?.user.name ?? "Sermo"} uri={session?.user.avatar_uri} />
          </button>
          <div className="row-main menu-profile-copy">
            <div className="menu-profile-heading">
              <strong>{session?.user.name ?? "Sermo User"}</strong>
            </div>
            <div className="row-subtle">
              {space?.name ?? "当前 Space"}
              {space?.slug ? <span className="menu-space-slug">@{space.slug}</span> : null}
            </div>
          </div>
          <button className="ghost-button inline-avatar-button" onClick={() => setAvatarDialogOpen(true)} type="button">
            更换头像
          </button>
        </div>

        {viewState === "loading" ? <FeedbackState title="菜单加载中" description="正在同步你的常用入口。" tone="loading" /> : null}
        <section className="list-section">
          <div className="section-label">常用</div>
          <div className="simple-list">
            <Link className="simple-row menu-link-row" to="/app/settings/account">
              <div className="row-icon notification-icon">
                <span className="material-symbols-outlined">badge</span>
              </div>
              <div className="row-main">
                <strong>账号与验证</strong>
                <div className="row-subtle">邮箱验证、密码和欢迎语</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
            <Link className="simple-row menu-link-row" to="/app/settings/notifications">
              <div className="row-icon notification-icon success">
                <span className="material-symbols-outlined">notifications</span>
              </div>
              <div className="row-main">
                <strong>通知偏好</strong>
                <div className="row-subtle">提醒方式与离线阈值</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
        </section>

        <section className="list-section">
          <div className="section-label">账号</div>
          <div className="simple-list">
            <Link className="simple-row menu-link-row" to="/app/settings/contacts">
              <div className="row-main">
                <strong>联系方式</strong>
                <div className="row-subtle">Email、SMS、Bark</div>
              </div>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
        </section>

        <section className="list-section">
          <div className="section-label">退出</div>
          <div className="simple-list">
            <button className="simple-row menu-link-row danger-row menu-danger-row" onClick={() => void leave()} type="button">
              <div className="row-main">
                <strong>退出登录</strong>
                <div className="row-subtle">离开当前 Space</div>
              </div>
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </section>
      </section>
      <AvatarPresetDialog
        currentAvatarUri={session?.user.avatar_uri}
        displayName={session?.user.name ?? "Sermo User"}
        onClose={() => setAvatarDialogOpen(false)}
        onSave={savePresetAvatar}
        open={avatarDialogOpen}
        saving={avatarSaving}
      />
      <AsyncErrorDialog message={error ?? ""} onClose={() => setError(null)} open={Boolean(error)} />
    </AppChrome>
  );
}
