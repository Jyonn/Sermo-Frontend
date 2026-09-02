import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { UserProfilePanel } from "../components/UserProfilePanel";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";

export default function FriendProfilePage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { friendId } = useParams();
  const userId = Number(friendId);
  const [syncing, setSyncing] = useState(false);

  return (
    <AppChrome title={session?.user.user_id === userId ? t("profile.myCard") : t("profile.details")} hideTopbar shellClassName="shell-friend-profile">
      <header className="minimal-page-header friend-profile-header">
        <button className="chat-back-button" onClick={() => navigate(-1)} type="button" aria-label={t("profile.back")}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className={`friend-profile-sync${syncing ? " is-syncing" : ""}`} aria-hidden="true" />
      </header>
      <main className="friend-profile-page">
        {Number.isFinite(userId) ? <UserProfilePanel key={userId} userId={userId} onSyncingChange={setSyncing} /> : null}
      </main>
    </AppChrome>
  );
}
