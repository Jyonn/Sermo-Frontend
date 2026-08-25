import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppChrome } from "../components/AppChrome";
import { HeaderSyncIndicator } from "../components/HeaderSyncIndicator";
import { UserProfilePanel } from "../components/UserProfilePanel";
import { useI18n } from "../lib/language";

export default function FriendProfilePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { friendId } = useParams();
  const userId = Number(friendId);
  const [syncing, setSyncing] = useState(false);

  return (
    <AppChrome title={t("profile.details")} hideTopbar shellClassName="shell-friend-profile">
      <header className="minimal-page-header friend-profile-header">
        <button className="chat-back-button" onClick={() => navigate(-1)} type="button" aria-label={t("profile.back")}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="friend-profile-page-title">
          <strong>{t("profile.details")}</strong>
          <HeaderSyncIndicator syncing={syncing} />
        </div>
      </header>
      <main className="friend-profile-page">
        {Number.isFinite(userId) ? <UserProfilePanel key={userId} userId={userId} onSyncingChange={setSyncing} /> : null}
      </main>
    </AppChrome>
  );
}
