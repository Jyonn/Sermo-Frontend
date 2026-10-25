import { useState } from "react";
import { useI18n } from "../lib/language";
import { SideDrawer } from "./SideDrawer";
import { UserProfilePanel, type UserProfileSeed } from "./UserProfilePanel";

export function MyProfileCardDrawer({ open, onClose, onRouteOpen, user }: {
  open: boolean;
  onClose: () => void;
  onRouteOpen?: () => void;
  user: UserProfileSeed;
}) {
  const { t } = useI18n();
  const [audience, setAudience] = useState<"friend" | "stranger">("friend");
  return <SideDrawer headerless historyKey="my-profile-card" onRouteOpen={onRouteOpen} open={open} onClose={onClose} title={t("profile.myCard")} floatingAccessory={
    <div className="profile-audience-switch" role="group" aria-label={t("profile.cardAudience")}>
      {(["friend", "stranger"] as const).map((value) => <button key={value} type="button" aria-pressed={audience === value} onClick={() => setAudience(value)}>{t(value === "friend" ? "profile.friendView" : "profile.strangerView")}</button>)}
    </div>
  }>
    {open ? <UserProfilePanel userId={user.user_id} initialUser={user} previewAudience={audience} /> : null}
  </SideDrawer>;
}
