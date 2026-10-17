import { useState } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import { getUpdateReport } from "../lib/updateDiagnostics";

export function UpdateReportButton() {
  const { t } = useI18n();
  const [status, setStatus] = useState<"idle" | "uploading" | "sent" | "failed">("idle");
  return <div role="status"><button className="ghost-button" disabled={status === "uploading" || status === "sent"} type="button" onClick={() => {
    setStatus("uploading");
    void api.uploadDebugReport(getUpdateReport()).then(() => setStatus("sent"), () => setStatus("failed"));
  }}>{t(`update.report.${status}`)}</button></div>;
}
