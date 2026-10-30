import { GrowthLevelBadge } from "./GrowthLevelBadge";
import { OfficialBadge } from "./OfficialBadge";
import { OperatorBadge } from "./OperatorBadge";
import { UserAvatar } from "./UserAvatar";
import type { UserDTO } from "../types";
import { useI18n } from "../lib/language";
import "./FounderMedals.css";
import { GrowthHonor } from "./GrowthHonor";
import { ExplorerProfileScene } from "./ExplorerProfileScene";
import { AnnualMedal } from "./AnnualMedal";

interface UserProfileCardProps {
  profileTheme?: UserDTO["profile_card_theme"];
  avatarLabel?: string;
  avatarFrame?: UserDTO["avatar_frame_style"];
  avatarUri?: string;
  growthLevel?: number;
  growthLevelName?: string;
  founderMedalYears?: number[];
  explorerBadgeYears?: number[];
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
  profileTheme,
  avatarLabel,
  avatarFrame,
  avatarUri,
  growthLevel,
  growthLevelName,
  founderMedalYears,
  explorerBadgeYears,
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
      <div className="user-profile-cover" aria-hidden="true">{profileTheme === "explorer-romance" ? <ExplorerProfileScene /> : null}</div>
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
      {growthHonor || founderMedalYears?.length || explorerBadgeYears?.length ? <div className="user-profile-awards">
        {explorerBadgeYears?.filter((year) => year === 2026).map((year) => <AnnualMedal kind="explorer" year={year} name={t("explorer.reward.5")} key={year} />)}
        {growthHonor ? <GrowthHonor honor={growthHonor} /> : null}
        {founderMedalYears?.map(year => <AnnualMedal kind="founder" year={year} name={t("profile.founderMedalName")} label={t("profile.founderMedal", { year })} key={year} />)}
      </div> : null}
    </section>
  );
}
