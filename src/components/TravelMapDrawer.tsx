import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { geoMercator, geoNaturalEarth1, geoPath } from "d3-geo";
import countries from "i18n-iso-countries";
import enCountries from "i18n-iso-countries/langs/en.json";
import zhCountries from "i18n-iso-countries/langs/zh.json";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-110m.json";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { SideDrawer } from "./SideDrawer";
import { UserAvatar } from "./UserAvatar";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/language";
import { showToast } from "../lib/toast";
import type { TinyUserDTO, TravelMapRegionDTO } from "../types";

countries.registerLocale(enCountries);
countries.registerLocale(zhCountries);

interface TravelMapDrawerProps {
  open: boolean;
  onClose: () => void;
  chatId?: number | null;
  chatTitle?: string;
  otherUser?: TinyUserDTO | null;
}

interface RegionProperties {
  name?: string;
  code?: string;
}

interface MapOwner {
  owner: TinyUserDTO;
  regions: TravelMapRegionDTO[];
}

interface MapTransform {
  x: number;
  y: number;
  scale: number;
}

const WIDTH = 920;
const HEIGHT = 500;

function worldFeatures() {
  const topology = worldTopology as unknown as { objects: { countries: Parameters<typeof feature>[1] } };
  return (feature(topology as never, topology.objects.countries) as unknown as FeatureCollection).features;
}

function countryCodeOf(item: Feature) {
  return countries.numericToAlpha3(String(item.id ?? "").padStart(3, "0")) || "";
}

function countryName(code: string, language: string) {
  return countries.getName(code, language === "zh-CN" ? "zh" : "en") || code;
}

function regionCode(country: string, item: Feature<Geometry, RegionProperties>) {
  return `${country}:${item.properties?.code || item.properties?.name || ""}`;
}

function normalizedRegionName(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/special administrative region|autonomous region|municipality|province/g, "")
    .replace(/\u58ee\u65cf\u81ea\u6cbb\u533a|\u56de\u65cf\u81ea\u6cbb\u533a|\u7ef4\u543e\u5c14\u81ea\u6cbb\u533a|\u7279\u522b\u884c\u653f\u533a|\u81ea\u6cbb\u533a|\u7701|\u5e02/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function hasRegion(regions: TravelMapRegionDTO[], code: string, name: string) {
  const normalizedName = normalizedRegionName(name);
  return regions.some((item) => (
    item.region_code === code
    || (item.country_code === code.slice(0, 3) && normalizedRegionName(item.region_name) === normalizedName)
  ));
}

function rewindForD3(collection: FeatureCollection<Geometry, RegionProperties>) {
  const rewindGeometry = (geometry: Geometry): Geometry => {
    if (geometry.type === "Polygon") {
      return { ...geometry, coordinates: geometry.coordinates.map((ring) => [...ring].reverse()) };
    }
    if (geometry.type === "MultiPolygon") {
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => [...ring].reverse())),
      };
    }
    if (geometry.type === "GeometryCollection") {
      return { ...geometry, geometries: geometry.geometries.map(rewindGeometry) };
    }
    return geometry;
  };
  return {
    ...collection,
    features: collection.features.map((item) => ({
      ...item,
      geometry: rewindGeometry(item.geometry),
    })),
  };
}

export function TravelMapDrawer({ open, onClose, chatId, chatTitle, otherUser }: TravelMapDrawerProps) {
  const { session } = useAuth();
  const { language, t } = useI18n();
  const [mode, setMode] = useState<"world" | "china">("world");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [maps, setMaps] = useState<MapOwner[]>([]);
  const [geometry, setGeometry] = useState<FeatureCollection<Geometry, RegionProperties> | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [transform, setTransform] = useState<MapTransform>({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);

  const world = useMemo(worldFeatures, []);
  const activeCountry = mode === "china" ? "CHN" : selectedCountry;
  const currentUserId = session?.user.user_id;
  const mine = maps.find((item) => item.owner.user_id === currentUserId);
  const others = maps.filter((item) => item.owner.user_id !== currentUserId);
  const myRegions = mine?.regions ?? [];
  const otherRegions = useMemo(() => others.flatMap((item) => item.regions), [others]);
  const myCountries = useMemo(() => new Set((mine?.regions ?? []).map((item) => item.country_code)), [mine]);
  const otherCountries = useMemo(() => new Set(others.flatMap((item) => item.regions.map((region) => region.country_code))), [others]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    const request = chatId
      ? api.getChatTravelMaps(chatId, controller.signal).then((payload) => setMaps(payload.maps))
      : otherUser
        ? api.getTravelMap(otherUser.user_id, controller.signal).then((payload) => setMaps([
          { owner: payload.me, regions: payload.my_regions },
          { owner: payload.other, regions: payload.other_regions },
        ]))
        : api.getMyTravelMap(controller.signal).then((payload) => setMaps([{ owner: payload.owner, regions: payload.regions }]));
    void request.catch((error) => {
      if (!controller.signal.aborted) showToast(error instanceof ApiError ? error.message : t("travelMap.loadFailed"), "error");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [open, chatId, otherUser?.user_id]);

  useEffect(() => {
    if (!open || !activeCountry) {
      setGeometry(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setTransform({ x: 0, y: 0, scale: 1 });
    void fetch(`/maps/adm1/${activeCountry}.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("geometry unavailable");
        return response.json() as Promise<FeatureCollection<Geometry, RegionProperties>>;
      })
      .then((payload) => setGeometry(rewindForD3(payload)))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGeometry(null);
        showToast(t("travelMap.geometryFailed"), "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeCountry, open]);

  const detailPath = useMemo(() => geometry
    ? geoPath(geoMercator().fitExtent([[26, 26], [WIDTH - 26, HEIGHT - 26]], geometry))
    : null, [geometry]);
  const worldPath = useMemo(() => geoPath(geoNaturalEarth1().fitExtent(
    [[18, 18], [WIDTH - 18, HEIGHT - 18]],
    { type: "FeatureCollection", features: world } as FeatureCollection,
  )), [world]);

  const tone = (mineSet: Set<string>, otherSet: Set<string>, code: string) => {
    if (mineSet.has(code) && otherSet.has(code)) return "overlap";
    if (mineSet.has(code)) return "mine";
    if (otherSet.has(code)) return "theirs";
    return "empty";
  };

  const checkIn = () => {
    if (chatId || otherUser || checkingIn) return;
    if (!navigator.geolocation) {
      showToast(t("travelMap.locationUnsupported"), "error");
      return;
    }
    setCheckingIn(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void api.checkInTravelMap({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_meters: position.coords.accuracy,
        }).then((payload) => {
          setMaps([{ owner: payload.owner, regions: payload.regions }]);
          setMode(payload.checked_region.country_code === "CHN" ? "china" : "world");
          setSelectedCountry(payload.checked_region.country_code);
          showToast(t("travelMap.checkedIn", { region: payload.checked_region.region_name }));
        }).catch((error) => {
          showToast(error instanceof ApiError ? error.message : t("travelMap.saveFailed"), "error");
        }).finally(() => setCheckingIn(false));
      },
      () => {
        setCheckingIn(false);
        showToast(t("travelMap.locationFailed"), "error");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  };

  const zoom = (delta: number) => setTransform((current) => ({
    ...current,
    scale: Math.min(4, Math.max(1, current.scale + delta)),
  }));
  const resetView = () => {
    setMode("world");
    setSelectedCountry(null);
    setGeometry(null);
    setTransform({ x: 0, y: 0, scale: 1 });
  };
  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.25 : -0.25);
  };
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y };
  };
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || transform.scale <= 1) return;
    setTransform((current) => ({
      ...current,
      x: drag.originX + event.clientX - drag.x,
      y: drag.originY + event.clientY - drag.y,
    }));
  };

  const title = chatId ? (chatTitle || t("travelMap.sharedFootprints")) : otherUser
    ? t("travelMap.sharedTitle", { name: otherUser.name })
    : t("travelMap.myTitle");
  const totalRegions = maps.reduce((sum, item) => sum + item.regions.length, 0);

  return (
    <SideDrawer open={open} onClose={onClose} title={title}>
      <div className="travel-map-drawer">
        <div className="travel-map-owner-row">
          <div className="travel-map-owner">
            <div className="travel-map-owner-avatars">
              {maps.slice(0, 4).map((item) => (
                <UserAvatar className="mini-avatar" key={item.owner.user_id} name={item.owner.name} uri={item.owner.avatar_uri} />
              ))}
            </div>
            <span><strong>{chatId ? t("travelMap.sharedFootprints") : t("travelMap.myFootprints")}</strong><small>{t("travelMap.regionCount", { count: totalRegions })}</small></span>
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
            aria-label={activeCountry ? countryName(activeCountry, language) : t("travelMap.world")}
            onPointerCancel={() => { dragRef.current = null; }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => { dragRef.current = null; }}
            onWheel={handleWheel}
            role="img"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
              {!activeCountry ? world.map((country) => {
                const code = countryCodeOf(country);
                const path = worldPath(country);
                if (!code || !path) return null;
                return (
                  <path className={`travel-map-region is-${tone(myCountries, otherCountries, code)} is-country`} d={path} key={String(country.id)} onClick={() => setSelectedCountry(code)}>
                    <title>{countryName(code, language)}</title>
                  </path>
                );
              }) : geometry?.features.map((region, index) => {
                const code = regionCode(activeCountry, region);
                const name = region.properties?.name || code;
                const mineVisited = hasRegion(myRegions, code, name);
                const othersVisited = hasRegion(otherRegions, code, name);
                const path = detailPath?.(region);
                return path ? (
                  <path className={`travel-map-region is-${mineVisited && othersVisited ? "overlap" : mineVisited ? "mine" : othersVisited ? "theirs" : "empty"}`} d={path} key={`${code}:${index}`}>
                    <title>{name}</title>
                  </path>
                ) : null;
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
          {others.length ? <span><i className="is-theirs" />{t("travelMap.others")}</span> : null}
          {others.length ? <span><i className="is-overlap" />{t("travelMap.overlap")}</span> : null}
        </div>

        {activeCountry ? (
          <button className="travel-map-country-back" onClick={resetView} type="button">
            <span>←</span>
            <span><strong>{countryName(activeCountry, language)}</strong><small>{t("travelMap.readOnlyRegions")}</small></span>
          </button>
        ) : null}

        {!chatId && !otherUser ? (
          <button className="button travel-map-check-in-button" disabled={checkingIn} onClick={checkIn} type="button">
            {checkingIn ? t("travelMap.locating") : t("travelMap.checkInHere")}
          </button>
        ) : null}
      </div>
    </SideDrawer>
  );
}
