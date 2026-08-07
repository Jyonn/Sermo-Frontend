import { AppChrome } from "../components/AppChrome";
import { FeedbackState } from "../components/FeedbackState";
import { TabPageHeader } from "../components/TabPageHeader";
import { useI18n } from "../lib/language";

export default function SquarePage() {
  const { t } = useI18n();
  return (
    <AppChrome title={t("square.title")} shellClassName="desktop-tab-shell square-community-shell">
      <main className="list-screen square-community-reset">
        <TabPageHeader title={t("square.title")} />
        <FeedbackState title={t("square.communityResetTitle")} description={t("square.communityResetHint")} />
      </main>
    </AppChrome>
  );
}
