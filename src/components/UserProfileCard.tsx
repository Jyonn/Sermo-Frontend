import { GrowthLevelBadge } from "./GrowthLevelBadge";
import { OfficialBadge } from "./OfficialBadge";
import { OperatorBadge } from "./OperatorBadge";
import { UserAvatar } from "./UserAvatar";
import type { UserDTO } from "../types";
import { useI18n } from "../lib/language";
import "./FounderMedals.css";
import { GrowthHonor } from "./GrowthHonor";

interface UserProfileCardProps {
  avatarLabel?: string;
  avatarFrame?: UserDTO["avatar_frame_style"];
  avatarUri?: string;
  growthLevel?: number;
  growthLevelName?: string;
  founderMedalYears?: number[];
  growthHonor?: UserDTO["growth_honor"];
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
  growthHonor,
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
      {growthHonor || founderMedalYears?.length ? <div className="user-profile-awards">
        {growthHonor ? <GrowthHonor honor={growthHonor} /> : null}
        {founderMedalYears?.map(year => <div className="founder-medal" aria-label={t("profile.founderMedal", { year })} key={year}><span className="material-symbols-outlined" aria-hidden="true">workspace_premium</span><span><small>{year}</small><strong>{t("profile.founderMedalName")}</strong></span></div>)}
      </div> : null}
    </section>
  );
}
