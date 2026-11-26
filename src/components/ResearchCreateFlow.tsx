import { useState } from "react";
import { useI18n } from "../lib/language";
import { researchToday } from "../lib/researchWorkbench";
import { DateRangeField } from "./DateRangeField";
import { MarkdownInput } from "./ResearchMarkdownInput";
import { SideDrawer } from "./SideDrawer";

export type ResearchDraft = { title: string; start: string; end: string | null; description: string };

export function ResearchCreateFlow({ busy, error, onClose, onCreate }: {
  busy: boolean; error: string; onClose: () => void; onCreate: (draft: ResearchDraft) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [range, setRange] = useState(() => ({ from: researchToday(), to: "" }));

  return <SideDrawer open className="research-workflow-drawer" historyKey="research-create-project" title={t("research.create")}
    onClose={() => { if (!busy) onClose(); }}>
    <form className="research-form research-task-editor" onSubmit={event => {
      event.preventDefault();
      if (!title.trim() || busy) return;
      void onCreate({ title: title.trim(), start: range.from, end: range.to || null, description });
    }}>
      <label>{t("research.name")}
        <input name="title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={50} disabled={busy} />
      </label>
      <DateRangeField value={range} onChange={setRange} />
      <section className="research-task-editor-section">
        <h3>{t("researchWorkbench.optionalDescription")}</h3>
      <MarkdownInput value={description} onChange={setDescription} rows={4} mobileImmersive={false} />
      </section>
      {error && <p className="research-form-error" role="alert">{error}</p>}
      <footer className="research-task-editor-footer">
        <button className="button" type="submit" disabled={busy || !title.trim()}>{t(busy ? "common.processing" : "research.create")}</button>
      </footer>
    </form>
  </SideDrawer>;
}
