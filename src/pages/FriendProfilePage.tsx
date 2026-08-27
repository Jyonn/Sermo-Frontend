import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { UserProfilePanel } from "../components/UserProfilePanel";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";

export default function FriendProfilePage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { friendId } = useParams();
  const userId = Number(friendId);
  const title = session?.user.user_id === userId ? t("profile.myCard") : t("profile.details");
  const [syncing, setSyncing] = useState(false);

  return (
    <AppChrome title={title} hideTopbar shellClassName="shell-friend-profile">
      <header className="minimal-page-header friend-profile-header">
        <button className="chat-back-button" onClick={() => navigate(-1)} type="button" aria-label={t("profile.back")}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="friend-profile-page-title">
          <strong>{title}</strong>
          <HeaderSyncIndicator syncing={syncing} />
        </div>
      </header>
      <main className="friend-profile-page">
        {Number.isFinite(userId) ? <UserProfilePanel key={userId} userId={userId} onSyncingChange={setSyncing} /> : null}
      </main>
    </AppChrome>
  );
}
