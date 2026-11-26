import { useI18n } from "../lib/language";
import { HeaderIconButton } from "./HeaderIconButton";

export function ResearchProjectHeader({ title, onBack, onMenu, onChat, disabled = false }: {
  title: string; onBack: () => void; onMenu: () => void; onChat: () => void; disabled?: boolean;
}) {
  const { t } = useI18n();
  return <header className="research-project-header">
    <button className="research-project-switch" type="button" onClick={onBack}>
      <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
      {t("researchWorkbench.projects")}
    </button>
    <h1 title={title}>{title}</h1>
    <div className="research-project-header-actions">
      <HeaderIconButton label={t("research.group")} onClick={onChat} disabled={disabled}>
        <span className="material-symbols-outlined" aria-hidden="true">forum</span>
      </HeaderIconButton>
      <HeaderIconButton label={t("researchWorkbench.projectSettings")} onClick={onMenu} disabled={disabled}>
        <span className="material-symbols-outlined" aria-hidden="true">more_horiz</span>
      </HeaderIconButton>
    </div>
  </header>;
}
