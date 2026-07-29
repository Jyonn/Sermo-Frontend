import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { geoMercator, geoNaturalEarth1, geoPath } from "d3-geo";
import countries from "i18n-iso-countries";
import enCountries from "i18n-iso-countries/langs/en.json";
import zhCountries from "i18n-iso-countries/langs/zh.json";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-110m.json";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";

import { SideDrawer } from "./SideDrawer";
import { UserAvatar } from "./UserAvatar";
import { ApiError, api } from "../lib/api";
import { showToast } from "../lib/toast";
import type { TinyUserDTO, TravelMapRegionDTO } from "../types";
import { useI18n } from "../lib/language";

countries.registerLocale(enCountries);
countries.registerLocale(zhCountries);

type MapMode = "world" | "china";

interface TravelMapDrawerProps {
  open: boolean;
  otherUser?: TinyUserDTO | null;
  onClose: () => void;
  onShare?: () => void;
}

type RegionFeatureProperties = GeoJsonProperties & {
  shapeName?: string;
  shapeISO?: string;
  shapeID?: string;
  name?: string;
  NAME_1?: string;
  name_1?: string;
  iso_3166_2?: string;
  adm1_code?: string;
};

interface MapTransform {
  x: number;
  y: number;
  scale: number;
}

const WORLD_WIDTH = 920;
const WORLD_HEIGHT = 500;

function worldFeatures() {
  const topology = worldTopology as unknown as {
    objects: { countries: Parameters<typeof feature>[1] };
  };
  return (feature(topology as never, topology.objects.countries) as unknown as FeatureCollection).features;
}

function countryCodeOf(featureItem: Feature) {
  const numeric = String(featureItem.id ?? "").padStart(3, "0");
  return countries.numericToAlpha3(numeric) || "";
}

function regionIdentity(featureItem: Feature<Geometry, RegionFeatureProperties>, countryCode: string) {
  const properties = featureItem.properties ?? {};
  const name = String(properties.shapeName || properties.name || properties.NAME_1 || properties.name_1 || "").trim();
  const sourceCode = String(properties.shapeISO || properties.shapeID || properties.iso_3166_2 || properties.adm1_code || name).trim();
  return {
    code: `${countryCode}:${sourceCode || name}`,
    name: name || sourceCode || countryCode,
  };
}

function countryName(code: string, language: string) {
  return countries.getName(code, language === "zh-CN" ? "zh" : "en") || code;
}

function checkedCountries(regions: TravelMapRegionDTO[]) {
  return new Set(regions.map((region) => region.country_code));
}

export function TravelMapDrawer({ open, otherUser, onClose, onShare }: TravelMapDrawerProps) {
  const { language, t } = useI18n();
  const [mode, setMode] = useState<MapMode>("world");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [myRegions, setMyRegions] = useState<TravelMapRegionDTO[]>([]);
  const [otherRegions, setOtherRegions] = useState<TravelMapRegionDTO[]>([]);
  const [geometry, setGeometry] = useState<FeatureCollection | null>(null);
  const [geometryUnavailable, setGeometryUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [transform, setTransform] = useState<MapTransform>({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);

  const editable = !otherUser;
  const world = useMemo(worldFeatures, []);
  const activeCountry = mode === "china" ? "CHN" : selectedCountry;
  const activeCountryName = activeCountry ? countryName(activeCountry, language) : "";
  const myCodes = useMemo(() => new Set(myRegions.map((region) => region.region_code)), [myRegions]);
  const otherCodes = useMemo(() => new Set(otherRegions.map((region) => region.region_code)), [otherRegions]);
  const myCountryCodes = useMemo(() => checkedCountries(myRegions), [myRegions]);
  const otherCountryCodes = useMemo(() => checkedCountries(otherRegions), [otherRegions]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setGeometryUnavailable(false);
    const load = otherUser
      ? api.getTravelMap(otherUser.user_id, controller.signal).then((payload) => {
        setMyRegions(payload.my_regions);
        setOtherRegions(payload.other_regions);
      })
      : api.getMyTravelMap(controller.signal).then((payload) => {
        setMyRegions(payload.regions);
        setOtherRegions([]);
      });
    void load.catch((error) => {
      if (!controller.signal.aborted) showToast(error instanceof ApiError ? error.message : t("travelMap.loadFailed"), "error");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [open, otherUser?.user_id]);

  useEffect(() => {
    if (!open || !activeCountry) {
      setGeometry(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setGeometryUnavailable(false);
    void api.getTravelMapGeometry(activeCountry, controller.signal)
      .then((payload) => {
        setGeometry(payload);
        setGeometryUnavailable(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setGeometry(null);
          setGeometryUnavailable(true);
          showToast(error instanceof ApiError ? error.message : t("travelMap.geometryFailed"), "error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    setTransform({ x: 0, y: 0, scale: 1 });
    return () => controller.abort();
  }, [activeCountry, open]);

  const detailFeatures = (geometry?.features ?? []) as Array<Feature<Geometry, RegionFeatureProperties>>;
  const detailPath = useMemo(() => {
    if (!geometry) return null;
    return geoPath(geoMercator().fitExtent([[26, 26], [WORLD_WIDTH - 26, WORLD_HEIGHT - 26]], geometry));
  }, [geometry]);
  const worldPath = useMemo(
    () => geoPath(geoNaturalEarth1().fitExtent([[18, 18], [WORLD_WIDTH - 18, WORLD_HEIGHT - 18]], { type: "FeatureCollection", features: world } as FeatureCollection)),
    [world],
  );

  const regionTone = (code: string) => {
    const mine = myCodes.has(code);
    const theirs = otherCodes.has(code);
    if (mine && theirs) return "overlap";
    if (mine) return "mine";
    if (theirs) return "theirs";
    return "empty";
  };

  const countryTone = (code: string) => {
    const mine = myCountryCodes.has(code);
    const theirs = otherCountryCodes.has(code);
    if (mine && theirs) return "overlap";
    if (mine) return "mine";
    if (theirs) return "theirs";
    return "empty";
  };

  const toggleRegion = async (featureItem: Feature<Geometry, RegionFeatureProperties>) => {
    if (!editable || !activeCountry || savingCode) return;
    const identity = regionIdentity(featureItem, activeCountry);
    const checked = !myCodes.has(identity.code);
    setSavingCode(identity.code);
    try {
      const payload = await api.setTravelMapRegion({
        region_code: identity.code,
        region_name: identity.name,
        country_code: activeCountry,
        country_name: activeCountryName,
        checked: checked ? 1 : 0,
      });
      setMyRegions(payload.regions);
      showToast(checked ? t("travelMap.checkedIn", { region: identity.name }) : t("travelMap.checkInRemoved", { region: identity.name }));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("travelMap.saveFailed"), "error");
    } finally {
      setSavingCode(null);
    }
  };

  const toggleWholeCountry = async () => {
    if (!editable || !activeCountry || savingCode) return;
    const regionCode = `COUNTRY:${activeCountry}`;
    const checked = !myCodes.has(regionCode);
    setSavingCode(regionCode);
    try {
      const payload = await api.setTravelMapRegion({
        region_code: regionCode,
        region_name: activeCountryName,
        country_code: activeCountry,
        country_name: activeCountryName,
        checked: checked ? 1 : 0,
      });
      setMyRegions(payload.regions);
      showToast(checked ? t("travelMap.checkedIn", { region: activeCountryName }) : t("travelMap.checkInRemoved", { region: activeCountryName }));
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : t("travelMap.saveFailed"), "error");
    } finally {
      setSavingCode(null);
    }
  };

  const zoom = (delta: number) => {
    setTransform((current) => ({ ...current, scale: Math.min(4, Math.max(1, current.scale + delta)) }));
  };

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.25 : -0.25);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y };
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || transform.scale <= 1) return;
    setTransform((current) => ({
      ...current,
      x: drag.originX + (event.clientX - drag.x),
      y: drag.originY + (event.clientY - drag.y),
    }));
  };

  const resetView = () => {
    if (mode === "china") setMode("world");
    setSelectedCountry(null);
    setGeometry(null);
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={otherUser ? t("travelMap.sharedTitle", { name: otherUser.name }) : t("travelMap.myTitle")}
      actionLabel={editable && onShare ? t("travelMap.share") : undefined}
      onAction={editable && onShare ? onShare : undefined}
    >
      <div className="travel-map-drawer">
        <div className="travel-map-owner-row">
          <div className="travel-map-owner">
            <UserAvatar className="mini-avatar" name={otherUser?.name ?? t("travelMap.me")} uri={otherUser?.avatar_uri} />
            <span><strong>{otherUser?.name ?? t("travelMap.myFootprints")}</strong><small>{t("travelMap.regionCount", { count: otherUser ? otherRegions.length : myRegions.length })}</small></span>
          </div>
          <div className="travel-map-view-switch">
            <button className={mode === "world" ? "is-active" : ""} onClick={resetView} type="button">{t("travelMap.world")}</button>
            <button className={mode === "china" ? "is-active" : ""} onClick={() => { setMode("china"); setSelectedCountry("CHN"); }} type="button">{t("travelMap.china")}</button>
          </div>
        </div>

        <div className="travel-map-canvas">
          <div className="travel-map-paper-heading">
            <span>{activeCountry ? t("travelMap.exploring") : t("travelMap.worldAtlas")}</span>
            <strong>{activeCountry || t("travelMap.worldCode")}</strong>
          </div>
          <svg
            aria-label={activeCountry ? activeCountryName : t("travelMap.world")}
            onPointerCancel={() => { dragRef.current = null; }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => { dragRef.current = null; }}
            onWheel={handleWheel}
            role="img"
            viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
          >
            <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
              {!activeCountry ? world.map((country) => {
                const code = countryCodeOf(country);
                const path = worldPath(country);
                if (!code || !path) return null;
                return (
                  <path
                    className={`travel-map-region is-${countryTone(code)}`}
                    d={path}
                    key={String(country.id)}
                    onClick={() => setSelectedCountry(code)}
                  >
                    <title>{countryName(code, language)}</title>
                  </path>
                );
              }) : detailFeatures.map((region) => {
                const identity = regionIdentity(region, activeCountry);
                const path = detailPath?.(region);
                if (!path) return null;
                return (
                  <path
                    className={`travel-map-region is-${regionTone(identity.code)}${editable ? " is-editable" : ""}`}
                    d={path}
                    key={identity.code}
                    onClick={() => void toggleRegion(region)}
                  >
                    <title>{identity.name}</title>
                  </path>
                );
              })}
            </g>
          </svg>
          {loading ? <div className="travel-map-loading"><span /></div> : null}
          <div className="travel-map-zoom">
            <button aria-label={t("travelMap.zoomOut")} disabled={transform.scale <= 1} onClick={() => zoom(-0.5)} type="button">−</button>
            <button aria-label={t("travelMap.resetZoom")} onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} type="button">{Math.round(transform.scale * 100)}%</button>
            <button aria-label={t("travelMap.zoomIn")} disabled={transform.scale >= 4} onClick={() => zoom(0.5)} type="button">＋</button>
          </div>
        </div>

        <div className="travel-map-legend">
          <span><i className="is-mine" />{t("travelMap.mine")}</span>
          {otherUser ? <span><i className="is-theirs" />{t("travelMap.theirs", { name: otherUser.name })}</span> : null}
          {otherUser ? <span><i className="is-overlap" />{t("travelMap.overlap")}</span> : null}
        </div>

        {activeCountry ? (
          <div className="travel-map-country-actions">
            <button className="travel-map-country-back" onClick={resetView} type="button">
              <span>←</span>
              <span><strong>{activeCountryName}</strong><small>{editable ? t("travelMap.tapToCheckIn") : t("travelMap.comparingRegions")}</small></span>
            </button>
            {geometryUnavailable && editable ? (
              <button className="travel-map-country-checkin" disabled={Boolean(savingCode)} onClick={() => void toggleWholeCountry()} type="button">
                {myCodes.has(`COUNTRY:${activeCountry}`) ? t("travelMap.removeCountry") : t("travelMap.checkInCountry")}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="travel-map-hint">{t("travelMap.chooseCountry")}</p>
        )}
      </div>
    </SideDrawer>
  );
}
