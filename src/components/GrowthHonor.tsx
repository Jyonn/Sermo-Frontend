import { useI18n } from "../lib/language";
import type { GrowthHonorDTO } from "../types";
import "./GrowthExperience.css";

export function GrowthHonor({ honor }: { honor: GrowthHonorDTO }) {
  const { t, locale } = useI18n();
  return <section className="growth-honor" aria-label={t("growth.honorTitle")}>
    <span className="growth-honor-mark" aria-hidden="true">18</span>
    <div><strong>{t("growth.honorTitle")}</strong>
      {honor.earned_at ? <time dateTime={new Date(honor.earned_at * 1000).toISOString()}>{t("growth.honorDate", { date: new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(honor.earned_at * 1000) })}</time> : null}
    </div>
  </section>;
}
