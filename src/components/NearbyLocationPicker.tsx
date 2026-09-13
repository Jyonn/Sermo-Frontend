import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "../lib/api";
import { useI18n } from "../lib/language";
import type { NearbyPlaceDTO, SquareStatementDTO } from "../types";
import { SideDrawer } from "./SideDrawer";

export type SelectedLocation = NonNullable<SquareStatementDTO["location"]>;

export function NearbyLocationPicker({ open, onClose, onSelect, presentation = "drawer", chatClassName = "", chatStyle }: {
  open: boolean;
  onClose: () => void;
  onSelect: (location: SelectedLocation) => void;
  presentation?: "drawer" | "mobile-inline" | "chat-modal";
  chatClassName?: string;
  chatStyle?: CSSProperties;
}) {
  const { t } = useI18n();
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [origin, setOrigin] = useState<SelectedLocation | null>(null);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<NearbyPlaceDTO[]>([]);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [panelHeight, setPanelHeight] = useState(44);
  const openedRef = useRef(false);

  const locate = () => {
    setError("");
    if (!navigator.geolocation) {
      setError(t("square.locationUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const next = { latitude: coords.latitude, longitude: coords.longitude };
      setCenter(next);
      void api.resolveSquareLocation(next.latitude, next.longitude)
        .then(setOrigin)
        .catch(() => setOrigin({ ...next, address: "" }))
        .finally(() => setLocating(false));
    }, () => {
      setLocating(false);
      setError(t("square.locationFailed"));
    }, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 });
  };

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    setPanelHeight(44);
    setCenter(null);
    setOrigin(null);
    setQuery("");
    setPlaces([]);
    locate();
  }, [open]);

  useEffect(() => {
    if (!open || !center) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError("");
      void api.searchNearbySquareLocations(center.latitude, center.longitude, query)
        .then(({ places: results }) => { if (!cancelled) setPlaces(results); })
        .catch((cause) => {
          if (cancelled) return;
          setPlaces([]);
          setError(cause instanceof Error ? cause.message : t("square.locationSearchFailed"));
        })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, query ? 280 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [center, open, query, t]);

  const choose = (place: NearbyPlaceDTO | SelectedLocation) => {
    onSelect({
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address || ("name" in place ? place.name : ""),
      geocoding_provider: "geocoding_provider" in place ? place.geocoding_provider : "amap",
    });
    onClose();
  };

  const busy = locating || searching;
  const content = <div className="square-location-picker">
      <div className="square-location-search"><span className="material-symbols-outlined">search</span><input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder={t("square.locationSearchPlaceholder")} value={query} />{query ? <button aria-label={t("common.clear")} onClick={() => setQuery("")} type="button"><span className="material-symbols-outlined">close</span></button> : null}</div>
      <div className="square-location-context"><div><span className="material-symbols-outlined">near_me</span><span>{t("square.locationDistanceSort")}</span></div><button disabled={locating} onClick={locate} type="button"><span className={`material-symbols-outlined${locating ? " is-spinning" : ""}`}>my_location</span>{t("square.locationRefresh")}</button></div>
      <div className="square-location-results">
        {origin && !query ? <button className="square-location-result is-origin" onClick={() => choose(origin)} type="button"><span className="square-location-result-mark"><span className="material-symbols-outlined">my_location</span></span><span><strong>{t("square.locationCurrent")}</strong><small>{origin.address || t("square.locationCurrentHint")}</small></span><i>0 m</i></button> : null}
        {places.map((place) => <button className="square-location-result" key={place.id || `${place.longitude},${place.latitude}`} onClick={() => choose(place)} type="button"><span className="square-location-result-mark"><span className="material-symbols-outlined">location_on</span></span><span><strong>{place.name}</strong><small>{[place.type, place.business_area, place.address].filter(Boolean).join(" · ")}</small></span><i>{place.distance < 1000 ? `${place.distance} m` : `${(place.distance / 1000).toFixed(1)} km`}</i></button>)}
        {busy && !places.length ? <div className="square-location-state"><span className="material-symbols-outlined is-spinning">progress_activity</span><strong>{t("square.locationSearching")}</strong><small>{t("square.locationSearchingHint")}</small></div> : null}
        {!busy && error ? <div className="square-location-state is-error"><span className="material-symbols-outlined">location_off</span><strong>{t("square.locationSearchFailed")}</strong><small>{error}</small></div> : null}
        {!busy && !error && !places.length ? <div className="square-location-state"><span className="material-symbols-outlined">search_off</span><strong>{t("square.locationNoResults")}</strong><small>{t("square.locationNoResultsHint")}</small></div> : null}
      </div>
    </div>;
  if (!open) return null;
  const header = <header><i onPointerDown={(event) => {
    if (presentation !== "mobile-inline") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startHeight = panelHeight;
    const move = (moveEvent: PointerEvent) => setPanelHeight(Math.max(40, Math.min(50, startHeight + ((startY - moveEvent.clientY) / window.innerHeight) * 100)));
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }} /><strong>{t("square.locationPickerTitle")}</strong><button aria-label={t("common.close")} onClick={onClose} type="button"><span className="material-symbols-outlined">close</span></button></header>;
  if (presentation === "mobile-inline") return <section aria-label={t("square.locationPickerTitle")} className={`chat-location-picker-panel is-mobile-inline ${chatClassName}`.trim()} style={{ ...chatStyle, height: `${panelHeight}dvh` }}>
      {header}
      {content}
    </section>;
  if (presentation === "chat-modal") return <div className="chat-location-picker-layer is-modal" onClick={onClose} role="presentation">
    <section aria-label={t("square.locationPickerTitle")} aria-modal="true" className={`chat-location-picker-panel is-modal ${chatClassName}`.trim()} onClick={(event) => event.stopPropagation()} role="dialog" style={chatStyle}>
      {header}{content}
    </section>
  </div>;
  return <SideDrawer className="square-location-picker-drawer" historyKey="nearby-location-picker" onClose={onClose} open title={t("square.locationPickerTitle")}>{content}</SideDrawer>;
}
