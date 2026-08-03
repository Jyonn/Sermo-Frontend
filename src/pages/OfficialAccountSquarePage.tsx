import { useEffect, useState } from "react";
import { Alignment, Fit, Layout, useRive } from "@rive-app/react-webgl2";
import { AppChrome } from "../components/AppChrome";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";

const OFFICIAL_CHARACTER_SOURCE = `${import.meta.env.BASE_URL}rive/official-skin-demo.riv`;
const SKIN_COUNT = 4;

function readSavedSkin(userId?: number) {
  if (!userId) return 0;
  const value = Number(window.localStorage.getItem(`sermo:official-square-skin:${userId}`));
  return Number.isInteger(value) && value >= 0 && value < SKIN_COUNT ? value : 0;
}

export default function OfficialAccountSquarePage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const [skin, setSkin] = useState(() => readSavedSkin(session?.user.user_id));
  const [loadFailed, setLoadFailed] = useState(false);
  const { rive, RiveComponent } = useRive({
    src: OFFICIAL_CHARACTER_SOURCE,
    artboard: "Character",
    stateMachines: "Skin Demo",
    autoplay: true,
    autoBind: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoadError: () => setLoadFailed(true),
  });

  useEffect(() => {
    const skinProperty = rive?.viewModelInstance?.number("numSkin");
    if (!skinProperty) return;
    skinProperty.value = skin;
  }, [rive, skin]);

  const selectSkin = (nextSkin: number) => {
    setSkin(nextSkin);
    if (session?.user.user_id) {
      window.localStorage.setItem(`sermo:official-square-skin:${session.user.user_id}`, String(nextSkin));
    }
  };

  return (
    <AppChrome title={t("square.title")} hideTopbar shellClassName="desktop-tab-shell official-square-shell">
      <section className="official-square-prototype" aria-label={t("square.officialPrototype") }>
        <div className="official-square-character-stage">
          {loadFailed ? (
            <p className="official-square-load-error">{t("square.officialPrototypeFailed")}</p>
          ) : (
            <RiveComponent className="official-square-rive-character" aria-hidden="true" />
          )}
        </div>

        <div className="official-square-skin-switcher" role="group" aria-label={t("square.chooseSkin")}>
          {Array.from({ length: SKIN_COUNT }, (_, index) => (
            <button
              key={index}
              className={`official-square-skin${skin === index ? " is-active" : ""} skin-${index}`}
              onClick={() => selectSkin(index)}
              type="button"
              aria-label={t("square.skinOption", { index: index + 1 })}
              aria-pressed={skin === index}
            >
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </AppChrome>
  );
}
