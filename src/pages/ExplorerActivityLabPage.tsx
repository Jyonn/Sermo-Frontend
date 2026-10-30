import { useState } from "react";
import { ActivityCampaignCard, ActivityTitle } from "../components/ActivityCampaignCard";
import { ExplorerActivity } from "../components/ExplorerActivity";
import { SideDrawer } from "../components/SideDrawer";
import { useI18n } from "../lib/language";
import { useTheme } from "../lib/theme";
import type { ActivityCampaignDTO } from "../types";

function sampleActivity(completed: number): ActivityCampaignDTO {
  const resourceTypes = ["frame", "bubble", "background", "profile", "identity"];
  return {
    key: "explorer-2026", theme: "explorer", title: "2026 探索者", title_en: "Explorer 2026", summary: "", summary_en: "",
    starts_at: 1793289600, ends_at: 1798732800, active: true, assignment_mode: "automatic", duration_seconds: null,
    newly_claimed: false, verified: true, today_earned: false, claimable_points: 0, available_points: 0,
    contributed_points: 0, personal_event_count: 0, personal_event_target: 5, personal_reward_claimable: false,
    personal_reward: null, space_reward_claimable: null, official_user: null, space_total: 0, target: 5, milestones: [], awakenings: [],
    explorer: {
      year: 2026, completed_count: completed,
      themes: (["basic", "security", "apps", "square", "activity"] as const).map((key, index) => ({ key, completed: index < completed, checks: [{ key: ["signature", "email", "chronelle", "publish", "complete_activity"][index], completed: index < completed }] })),
      rewards: resourceTypes.map((resource_type, index) => ({ tier: index + 1, resource_type, resource_key: "preview", reward_id: `preview-${index}`, rarity: ["uncommon", "rare", "epic", "legendary", "legendary"][index], claimed: index < completed, unlocked: index < completed, claimable: false })),
    },
  };
}

// Public design study uses synthetic progress only; it never reads or claims real rewards.
export default function ExplorerActivityLabPage() {
  const { t } = useI18n();
  const { resolvedTheme, setPreference } = useTheme();
  const [completed, setCompleted] = useState(3);
  const [open, setOpen] = useState(true);
  const activity = sampleActivity(completed);
  return <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
    <h1>{t("explorer.title")}</h1>
    <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
      {[0, 3, 5].map((count) => <button className="ghost-button" type="button" aria-pressed={count === completed} key={count} onClick={() => setCompleted(count)}>{count} / 5</button>)}
      <button className="ghost-button" type="button" aria-label={t("menu.appearance")} onClick={() => setPreference(resolvedTheme === "dark" ? "light" : "dark")}><span className="material-symbols-outlined">{resolvedTheme === "dark" ? "light_mode" : "dark_mode"}</span></button>
    </div>
    <ActivityCampaignCard activity={activity} title={t("explorer.title")} eyebrow={t("message.activityEyebrow")} hint={t("message.activityOpen")} onClick={() => setOpen(true)} />
    <SideDrawer className="activity-drawer activity-transparent-header is-custom-activity" dismissAction="back" open={open} onClose={() => setOpen(false)} title={t("explorer.title")} titleAccessory={<ActivityTitle activity={activity} title={t("explorer.title")} />} headerAction={<button className="activity-drawer-share" aria-label={t("square.share")} onClick={() => setOpen(false)} type="button"><span className="material-symbols-outlined">share</span></button>}>
      <ExplorerActivity key={completed} activity={activity} onUpdate={() => undefined} onPublish={() => undefined} preview />
    </SideDrawer>
  </main>;
}
