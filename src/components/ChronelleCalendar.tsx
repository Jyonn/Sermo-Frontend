import { useState } from "react";
import { useI18n } from "../lib/language";
import { useTheme } from "../lib/theme";
import "./ChronelleCalendar.css";

export function ChronelleCalendar({ calendarId }: { calendarId?: string }) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const [loadedUrl, setLoadedUrl] = useState("");
  if (!calendarId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(calendarId)) return null;
  const shareUrl = `https://chronelle.jyonn.space/#/share/${calendarId}`;
  const embedUrl = `https://chronelle.jyonn.space/embed/#/share/${calendarId}?layout=minimal&view=week&theme=${resolvedTheme}&navigation=1&details=1`;
  return <section className="chronelle-calendar">
    <div className="chronelle-calendar-heading"><strong>{t("chronelle.title")}</strong><a href={shareUrl} target="_blank" rel="noopener noreferrer">{t("chronelle.open")} ↗</a></div>
    {loadedUrl !== embedUrl ? <p className="row-subtle" role="status">{t("chronelle.loading")}</p> : null}
    <iframe src={embedUrl} title={t("chronelle.title")} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" onLoad={() => setLoadedUrl(embedUrl)} />
    <small className="row-subtle">{t("chronelle.publicOnly")}</small>
  </section>;
}
