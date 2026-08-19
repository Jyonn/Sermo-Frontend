import { useState } from "react";
import { RarityIcon } from "../components/RarityIcon";
import { useI18n } from "../lib/language";
import type { TranslationKey } from "../lib/i18n";

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
type Direction = "rail" | "seal" | "index" | "halo";

const rarities: Array<{ rarity: Rarity; item: TranslationKey; style: string }> = [
  { rarity: "common", item: "menu.statementStyleDefault", style: "default" },
  { rarity: "uncommon", item: "menu.statementStyleEditorial", style: "editorial" },
  { rarity: "rare", item: "menu.statementStyleComic", style: "comic" },
  { rarity: "epic", item: "menu.statementStyleHero", style: "hero" },
  { rarity: "legendary", item: "menu.statementStyleNiko", style: "niko" },
];

const directions: Array<{ key: Direction; name: TranslationKey; note: TranslationKey; recommended?: boolean }> = [
  { key: "rail", name: "catalogLab.rail", note: "catalogLab.railNote" },
  { key: "seal", name: "catalogLab.seal", note: "catalogLab.sealNote" },
  { key: "index", name: "catalogLab.index", note: "catalogLab.indexNote" },
  { key: "halo", name: "catalogLab.halo", note: "catalogLab.haloNote", recommended: true },
];

export default function PersonalizationCatalogLabPage() {
  const { t } = useI18n();
  const [active, setActive] = useState<Direction>("halo");
  const direction = directions.find((item) => item.key === active) ?? directions[0];

  return (
    <main className="catalog-lab-page">
      <header className="catalog-lab-hero">
        <span className="catalog-lab-kicker">PERSONALIZATION / VISUAL STUDY</span>
        <h1>{t("catalogLab.title")}</h1>
        <p>{t("catalogLab.description")}</p>
      </header>

      <nav className="catalog-lab-switcher" aria-label={t("catalogLab.switchLabel")}>
        {directions.map((item, index) => (
          <button
            aria-pressed={active === item.key}
            className={active === item.key ? "is-active" : ""}
            key={item.key}
            onClick={() => setActive(item.key)}
            type="button"
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {t(item.name)}
          </button>
        ))}
      </nav>

      <section className={`catalog-lab-board direction-${direction.key}`}>
        <header className="catalog-lab-direction-copy">
          <div>
            <span>{directions.findIndex((item) => item.key === direction.key) + 1} / {directions.length}</span>
            {direction.recommended ? <b>{t("catalogLab.recommended")}</b> : null}
          </div>
          <h2>{t(direction.name)}</h2>
          <p>{t(direction.note)}</p>
        </header>

        <div className="catalog-lab-sections">
          {rarities.map((item, index) => (
            <section className={`catalog-lab-tier rarity-${item.rarity}`} key={item.rarity}>
              <header className="catalog-lab-tier-heading">
                <span className="catalog-lab-tier-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{t(`growth.rarity.${item.rarity}` as TranslationKey)}</h3>
                <span className="catalog-lab-tier-line" />
                <small>1</small>
              </header>
              <button className="catalog-lab-item" type="button">
                <span className={`catalog-lab-preview statement-style-${item.style}`}>
                  <span className="statement-card-style-sample"><i>{item.style === "hero" ? "GO!" : t("menu.statementStyleSample")}</i></span>
                </span>
                <span className="catalog-lab-name-row">
                  <RarityIcon rarity={item.rarity} />
                  <strong>{t(item.item)}</strong>
                </span>
              </button>
            </section>
          ))}
        </div>
      </section>

      <footer className="catalog-lab-footer">
        <strong>{t("catalogLab.recommendationTitle")}</strong>
        <p>{t("catalogLab.recommendation")}</p>
      </footer>
    </main>
  );
}
