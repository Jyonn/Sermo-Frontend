import { useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { UserProfilePanel } from "../components/UserProfilePanel";

export default function FriendProfilePage() {
  const navigate = useNavigate();
  const { friendId } = useParams();
  const userId = Number(friendId);

  return (
    <AppChrome title="用户详情" hideTopbar shellClassName="shell-friend-profile">
      <header className="chat-list-screen-header minimal-page-header friend-profile-header">
        <button className="chat-back-button" onClick={() => navigate(-1)} type="button" aria-label="返回上一页">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="friend-profile-page-title">
          <strong>用户详情</strong>
          <span>资料与共同关系</span>
        </div>
      </header>
      <main className="friend-profile-page">
        {Number.isFinite(userId) ? <UserProfilePanel userId={userId} /> : null}
      </main>
    </AppChrome>
  );
}
