import { GrowthLevelBadge } from "./GrowthLevelBadge";
import { OfficialBadge } from "./OfficialBadge";
import { OperatorBadge } from "./OperatorBadge";
import { UserAvatar } from "./UserAvatar";
import type { UserDTO } from "../types";
import { useI18n } from "../lib/language";
import "./FounderMedals.css";

interface UserProfileCardProps {
  avatarLabel?: string;
  avatarFrame?: UserDTO["avatar_frame_style"];
  avatarUri?: string;
  growthLevel?: number;
  growthLevelName?: string;
  founderMedalYears?: number[];
  isOnline?: boolean;
  isPermanentVip?: boolean;
  name: string;
  official?: boolean;
  operator?: boolean;
  onAvatarClick?: () => void;
  permanentVipLabel?: string;
  presence: string;
  relationshipLabel?: string;
}

export function UserProfileCard({
  avatarLabel,
  avatarFrame,
  avatarUri,
  growthLevel,
  growthLevelName,
  founderMedalYears,
  isOnline,
  isPermanentVip,
  name,
  official,
  operator,
  onAvatarClick,
  permanentVipLabel,
  presence,
  relationshipLabel,
}: UserProfileCardProps) {
  const { t } = useI18n();
  return (
    <section className="user-profile-social-card">
      <div className="user-profile-cover" aria-hidden="true" />
      <div className="user-profile-identity">
        <button
          aria-disabled={!onAvatarClick}
          aria-label={avatarLabel ?? name}
          className="user-profile-avatar-wrap"
          disabled={!avatarUri}
          onClick={onAvatarClick}
          tabIndex={onAvatarClick ? undefined : -1}
          type="button"
        >
          <UserAvatar
            className={`user-profile-avatar${isOnline ? " status-online" : ""}`}
            frame={avatarFrame}
            name={name}
            uri={avatarUri}
          />
        </button>
        <div className="user-profile-copy">
          <div className="user-profile-name-row">
            <h2>{name}</h2>
            {official ? <OfficialBadge /> : null}
            {operator ? <OperatorBadge /> : null}
          </div>
          <p className={isOnline ? "is-online" : ""}>{presence}</p>
        </div>
      </div>
      <div className="user-profile-facts">
        {!official && growthLevel ? <GrowthLevelBadge level={growthLevel} name={growthLevelName} /> : null}
        {isPermanentVip && permanentVipLabel ? <span className="is-vip">{permanentVipLabel}</span> : null}
        {relationshipLabel ? <span className="is-relationship">{relationshipLabel}</span> : null}
      </div>
      {founderMedalYears?.length ? <div className="founder-medals">{founderMedalYears.map(year => <div className="founder-medal" key={year}><span className="material-symbols-outlined" aria-hidden="true">workspace_premium</span><span><small>FRIENDEN</small><strong>{t("profile.founderMedal", { year })}</strong></span></div>)}</div> : null}
    </section>
  );
}
