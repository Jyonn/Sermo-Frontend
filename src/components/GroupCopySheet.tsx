import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { ContentLoader, QuietState } from "./BoundaryState";
import { useI18n } from "../lib/language";
import { copyText } from "../lib/presentation";
import { showToast } from "../lib/toast";
import type { CopySuggestion } from "../lib/groupCopy";
import { reportGroupCopies } from "./GroupCopyReporting";
export function GroupCopySheet({ open, onClose, items, loading, error, retry, chatId, userId }: { open: boolean; onClose: () => void; items: CopySuggestion[]; loading: boolean; error: boolean; retry: () => void; chatId: number; userId: number }) {
  const { t } = useI18n(); const [busy, setBusy] = useState<number | null>(null);
  return <BottomSheet open={open} onClose={onClose} title={t("copyShelf.title")}>
    {loading ? <ContentLoader label={t("common.loading")} rows={2} /> : error ? <><QuietState title={t("common.loadFailed")} icon="error" /><button className="ghost-button" type="button" onClick={retry}>{t("common.retry")}</button></> : !items.length ? <QuietState icon="content_copy" title={t("quickActions.noCopies")} /> : <div className="quick-copy-list">{items.map(item => <button key={item.message_id} type="button" disabled={busy !== null} className={`group-copy-item${item.copied ? " is-copied" : ""}`} onClick={async () => {
      if (busy !== null) return; setBusy(item.message_id);
      try { if (!await copyText(item.content)) throw new Error(); reportGroupCopies(chatId, userId, [item.message_id]); showToast(t("message.batchCopied", { count: 1 })); }
      catch { showToast(t("common.copyFailed"), "error"); } finally { setBusy(null); }
    }}><span className="group-copy-author">{item.author}<span className="material-symbols-outlined">{busy === item.message_id ? "progress_activity" : item.copied ? "check" : "content_copy"}</span></span><span className="group-copy-text">{item.content}</span><small>{t(item.copied ? "copyShelf.copied" : "copyShelf.tap")}</small></button>)}</div>}
  </BottomSheet>;
}
